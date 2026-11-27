-- PWA: offline-safe inserts and push notifications to owners/admins.

-- 1. Offline-safe inserts. The app sends its own uuid for records it may retry
--    (entries saved offline, or a save whose reply was lost). A retry then hits
--    the primary key (23505) instead of creating a second row.
grant insert (id) on public.labour_entries, public.material_entries, public.vat_bills, public.bbs_items to authenticated;

-- 2. Push subscriptions: one row per phone/browser that turned notifications on.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy push_select_own on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_delete_own on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Saving goes through this function: a shared phone may still hold the previous
-- person's subscription for the same endpoint, which the new person cannot see.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- 3. When site staff add a record, ask the `push` Edge Function to notify the firm's
--    owners/admins. The function URL and shared secret live in Vault
--    (names: push_url, push_secret; see docs/DEPLOY.md). Without them this does nothing.
create extension if not exists pg_net with schema extensions;

create or replace function private.notify_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.memberships m
    where m.org_id = new.org_id and m.user_id = new.created_by and m.role = 'site_staff'
  ) then
    return null;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('table', tg_table_name, 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
  );
  return null;
end;
$$;

create trigger labour_entries_notify after insert on public.labour_entries
  for each row execute function private.notify_record();
create trigger material_entries_notify after insert on public.material_entries
  for each row execute function private.notify_record();
create trigger vat_bills_notify after insert on public.vat_bills
  for each row execute function private.notify_record();
create trigger bbs_items_notify after insert on public.bbs_items
  for each row execute function private.notify_record();
