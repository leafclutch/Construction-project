-- Nirman Sathi core schema.
-- Tenant = organization (a thekedar firm). Every business row carries org_id and
-- is protected by RLS through membership. Roles: owner > admin > site_staff.

create extension if not exists pgcrypto;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'admin', 'site_staff');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  role public.member_role not null check (role <> 'owner'),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_org_idx on public.invites (org_id);

-- Helpers live in a schema the API does not expose. SECURITY DEFINER so RLS
-- policies can check membership without recursing into memberships' own RLS.
create function private.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create function private.is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

create function private.shares_org(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on b.org_id = a.org_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;


-- Profile row for every new auth user.
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Projects (sites)
-- ---------------------------------------------------------------------------

create type public.project_status as enum ('running', 'on_hold', 'completed');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 200),
  code text check (char_length(code) <= 120),
  location text check (char_length(location) <= 200),
  client_name text check (char_length(client_name) <= 200),
  contract_amount numeric(14, 2) not null default 0 check (contract_amount >= 0),
  billed_amount numeric(14, 2) not null default 0 check (billed_amount >= 0),
  status public.project_status not null default 'running',
  start_date date,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create index projects_org_idx on public.projects (org_id);

-- ---------------------------------------------------------------------------
-- Modules. (project_id, org_id) FK guarantees a row's project is in its org.
-- ---------------------------------------------------------------------------

create type public.drawing_category as enum ('structural', 'architectural', 'mep', 'as_built');

create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  category public.drawing_category not null,
  file_path text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  mime_type text not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index drawings_project_idx on public.drawings (project_id, created_at desc);

create table public.boq_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  unit text not null check (char_length(btrim(unit)) between 1 and 20),
  quantity numeric(14, 3) not null check (quantity >= 0),
  rate numeric(14, 2) not null check (rate >= 0),
  amount numeric(16, 2) generated always as (round(quantity * rate, 2)) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index boq_items_project_idx on public.boq_items (project_id, created_at);

-- Unit weight of a steel bar in kg/m = D² / 162 (D in mm).
create table public.bbs_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  member text not null check (char_length(btrim(member)) between 1 and 200),
  bar_dia_mm integer not null check (bar_dia_mm in (6, 8, 10, 12, 16, 20, 25, 28, 32, 36, 40)),
  bar_count integer not null check (bar_count > 0),
  cut_length_m numeric(8, 3) not null check (cut_length_m > 0),
  unit_weight numeric(10, 3) generated always as (round(bar_dia_mm * bar_dia_mm / 162.0, 3)) stored,
  total_weight_kg numeric(14, 2) generated always as
    (round(bar_count * cut_length_m * bar_dia_mm * bar_dia_mm / 162.0, 2)) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index bbs_items_project_idx on public.bbs_items (project_id, created_at);

create table public.material_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  entry_date date not null default current_date,
  material text not null check (char_length(btrim(material)) between 1 and 100),
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null check (char_length(btrim(unit)) between 1 and 30),
  supplier text check (char_length(supplier) <= 300),
  challan_path text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index material_entries_project_idx on public.material_entries (project_id, entry_date desc);

create table public.labour_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  entry_date date not null default current_date,
  category text not null check (char_length(btrim(category)) between 1 and 60),
  worker_count integer not null check (worker_count between 1 and 10000),
  daily_rate numeric(12, 2) not null check (daily_rate >= 0),
  total_wage numeric(16, 2) generated always as (worker_count * daily_rate) stored,
  remarks text not null check (char_length(btrim(remarks)) between 1 and 300),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index labour_entries_project_idx on public.labour_entries (project_id, entry_date desc);

create table public.vat_bills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  bill_date date not null,
  bill_no text not null check (char_length(btrim(bill_no)) between 1 and 60),
  supplier_name text not null check (char_length(btrim(supplier_name)) between 1 and 200),
  supplier_pan text not null check (supplier_pan ~ '^[0-9]{9}$'),
  taxable_amount numeric(14, 2) not null check (taxable_amount >= 0),
  vat_included boolean not null default true,
  vat_amount numeric(14, 2) generated always as
    (case when vat_included then round(taxable_amount * 0.13, 2) else 0 end) stored,
  gross_amount numeric(14, 2) generated always as
    (taxable_amount + case when vat_included then round(taxable_amount * 0.13, 2) else 0 end) stored,
  file_path text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  unique (project_id, bill_no, supplier_pan)
);
create index vat_bills_project_idx on public.vat_bills (project_id, bill_date desc);

-- ---------------------------------------------------------------------------
-- Dashboard summary (security_invoker => caller's RLS applies)
-- ---------------------------------------------------------------------------

create view public.project_summaries with (security_invoker = true) as
select
  p.id as project_id,
  p.org_id,
  (select count(*) from public.material_entries m where m.project_id = p.id) as material_count,
  (select coalesce(sum(l.total_wage), 0) from public.labour_entries l where l.project_id = p.id) as labour_cost,
  (select coalesce(sum(l.worker_count), 0) from public.labour_entries l where l.project_id = p.id) as man_days,
  (select count(*) from public.vat_bills v where v.project_id = p.id) as vat_bill_count,
  (select coalesce(sum(v.gross_amount), 0) from public.vat_bills v where v.project_id = p.id) as vat_gross,
  (select coalesce(sum(b.total_weight_kg), 0) from public.bbs_items b where b.project_id = p.id) as steel_kg,
  (select coalesce(sum(q.amount), 0) from public.boq_items q where q.project_id = p.id) as boq_total,
  (select count(*) from public.drawings d where d.project_id = p.id) as drawing_count
from public.projects p;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.projects enable row level security;
alter table public.drawings enable row level security;
alter table public.boq_items enable row level security;
alter table public.bbs_items enable row level security;
alter table public.material_entries enable row level security;
alter table public.labour_entries enable row level security;
alter table public.vat_bills enable row level security;

-- Organizations: members read, admins rename. Creation only via RPC.
create policy org_select on public.organizations for select to authenticated
  using (private.is_member(id));
create policy org_update on public.organizations for update to authenticated
  using (private.is_admin(id)) with check (private.is_admin(id));

-- Profiles: self, or anyone sharing an org.
create policy profile_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_org(id));
create policy profile_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Memberships: members see their org's roster. Admins change/remove non-owners.
-- Inserts only via create_organization / accept_invite RPCs.
create policy membership_select on public.memberships for select to authenticated
  using (private.is_member(org_id));
create policy membership_update on public.memberships for update to authenticated
  using (private.is_admin(org_id) and role <> 'owner')
  with check (private.is_admin(org_id) and role <> 'owner');
create policy membership_delete on public.memberships for delete to authenticated
  using (role <> 'owner' and (private.is_admin(org_id) or user_id = (select auth.uid())));

-- Invites: admins only.
create policy invite_select on public.invites for select to authenticated
  using (private.is_admin(org_id));
create policy invite_insert on public.invites for insert to authenticated
  with check (private.is_admin(org_id) and created_by = (select auth.uid()));
create policy invite_delete on public.invites for delete to authenticated
  using (private.is_admin(org_id));

-- Projects: members read, admins write.
create policy project_select on public.projects for select to authenticated
  using (private.is_member(org_id));
create policy project_insert on public.projects for insert to authenticated
  with check (private.is_admin(org_id));
create policy project_update on public.projects for update to authenticated
  using (private.is_admin(org_id)) with check (private.is_admin(org_id));
create policy project_delete on public.projects for delete to authenticated
  using (private.is_admin(org_id));

-- Plan documents (drawings, BOQ): members read, admins write.
create policy drawing_select on public.drawings for select to authenticated using (private.is_member(org_id));
create policy drawing_insert on public.drawings for insert to authenticated with check (private.is_admin(org_id));
create policy drawing_update on public.drawings for update to authenticated using (private.is_admin(org_id)) with check (private.is_admin(org_id));
create policy drawing_delete on public.drawings for delete to authenticated using (private.is_admin(org_id));

create policy boq_select on public.boq_items for select to authenticated using (private.is_member(org_id));
create policy boq_insert on public.boq_items for insert to authenticated with check (private.is_admin(org_id));
create policy boq_update on public.boq_items for update to authenticated using (private.is_admin(org_id)) with check (private.is_admin(org_id));
create policy boq_delete on public.boq_items for delete to authenticated using (private.is_admin(org_id));

-- Site records (BBS, material, labour, VAT): any member records, admins correct/delete.
create policy bbs_select on public.bbs_items for select to authenticated using (private.is_member(org_id));
create policy bbs_insert on public.bbs_items for insert to authenticated with check (private.is_member(org_id));
create policy bbs_update on public.bbs_items for update to authenticated using (private.is_admin(org_id)) with check (private.is_admin(org_id));
create policy bbs_delete on public.bbs_items for delete to authenticated using (private.is_admin(org_id));

create policy material_select on public.material_entries for select to authenticated using (private.is_member(org_id));
create policy material_insert on public.material_entries for insert to authenticated with check (private.is_member(org_id));
create policy material_update on public.material_entries for update to authenticated using (private.is_admin(org_id)) with check (private.is_admin(org_id));
create policy material_delete on public.material_entries for delete to authenticated using (private.is_admin(org_id));

create policy labour_select on public.labour_entries for select to authenticated using (private.is_member(org_id));
create policy labour_insert on public.labour_entries for insert to authenticated with check (private.is_member(org_id));
create policy labour_update on public.labour_entries for update to authenticated using (private.is_admin(org_id)) with check (private.is_admin(org_id));
create policy labour_delete on public.labour_entries for delete to authenticated using (private.is_admin(org_id));

create policy vat_select on public.vat_bills for select to authenticated using (private.is_member(org_id));
create policy vat_insert on public.vat_bills for insert to authenticated with check (private.is_member(org_id));
create policy vat_update on public.vat_bills for update to authenticated using (private.is_admin(org_id)) with check (private.is_admin(org_id));
create policy vat_delete on public.vat_bills for delete to authenticated using (private.is_admin(org_id));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.organizations (name) values (btrim(p_name)) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  return v_org;
end;
$$;

create function public.accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into v_invite from public.invites
  where code = upper(btrim(p_code)) and accepted_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'Invite code is invalid or expired' using errcode = 'P0002';
  end if;
  insert into public.memberships (org_id, user_id, role)
  values (v_invite.org_id, auth.uid(), v_invite.role)
  on conflict (org_id, user_id) do nothing;
  update public.invites set accepted_by = auth.uid(), accepted_at = now() where id = v_invite.id;
  return v_invite.org_id;
end;
$$;

revoke execute on function public.create_organization(text) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- Keep projects.updated_at honest.
create function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger projects_touch before update on public.projects
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Storage: private buckets, objects keyed "<org_id>/<project_id>/<file>".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('drawings', 'drawings', false, 52428800,
    array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('receipts', 'receipts', false, 10485760,
    array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create function private.object_org(p_name text)
returns uuid language sql stable set search_path = '' as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$'
    then ((storage.foldername(p_name))[1])::uuid
  end;
$$;

create policy drawings_read on storage.objects for select to authenticated
  using (bucket_id = 'drawings' and private.is_member(private.object_org(name)));
create policy drawings_write on storage.objects for insert to authenticated
  with check (bucket_id = 'drawings' and private.is_admin(private.object_org(name)));
create policy drawings_delete on storage.objects for delete to authenticated
  using (bucket_id = 'drawings' and private.is_admin(private.object_org(name)));

create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and private.is_member(private.object_org(name)));
create policy receipts_write on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and private.is_member(private.object_org(name)));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and private.is_admin(private.object_org(name)));

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
