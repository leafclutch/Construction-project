-- Thekka is a managed SaaS, not a public site:
-- * Leafclutch super admins create firms and owner accounts (Edge Function "accounts").
--   No public signup, no invite codes.
-- * Owners/admins see and manage every project of their firm.
-- * Site staff see only the projects they are added to, with per-project permission toggles.
-- * Contract/billing figures need the "money.view" permission.
-- * Super admins can read every firm (support) but never write firm records.
-- * A firm can be suspended; a member can be turned off. Both cut data access at once.

-- ---------------------------------------------------------------------------
-- Remove the public self-serve flows
-- ---------------------------------------------------------------------------
drop function public.accept_invite(text);
drop function public.create_organization(text);
drop table public.invites;

-- ---------------------------------------------------------------------------
-- Platform (super admins). Rows are added by hand in SQL, see docs/DEPLOY.md.
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy platform_admin_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Firm status, member status, first-login password change
-- ---------------------------------------------------------------------------
create type public.org_status as enum ('active', 'suspended');
alter table public.organizations add column status public.org_status not null default 'active';
alter table public.memberships add column active boolean not null default true;
alter table public.profiles add column must_change_password boolean not null default false;

-- Membership checks now require an active member of an active firm.
create or replace function private.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.active and o.status = 'active'
  );
$$;

create or replace function private.is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.active and o.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

-- Any membership, even turned off or suspended: lets the app explain why access is gone.
create function private.belongs_to(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Project assignments with permissions
-- ---------------------------------------------------------------------------
create table public.project_members (
  project_id uuid not null,
  org_id uuid not null,
  user_id uuid not null,
  permissions text[] not null default '{}' check (permissions <@ array[
    'labour.view', 'labour.add', 'labour.edit', 'labour.delete',
    'materials.view', 'materials.add', 'materials.edit', 'materials.delete',
    'bills.view', 'bills.add', 'bills.edit', 'bills.delete',
    'steel.view', 'steel.add', 'steel.edit', 'steel.delete',
    'boq.view', 'boq.add', 'boq.edit', 'boq.delete',
    'drawings.view', 'drawings.add', 'drawings.delete',
    'money.view'
  ]::text[]),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  -- Only firm members can be on a project; removing the membership removes the assignments.
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);
create index project_members_member_idx on public.project_members (org_id, user_id);

-- Admins can do everything on their firm's projects. Staff need an assignment and,
-- when p_perm is given, that permission on it.
-- ponytail: called per row by RLS; fine for site-sized ledgers. Cache per statement if lists grow to 100k rows.
create function private.can(p_org uuid, p_project uuid, p_perm text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin(p_org) or exists (
    select 1 from public.project_members pm
    join public.memberships m on m.org_id = pm.org_id and m.user_id = pm.user_id
    join public.organizations o on o.id = pm.org_id
    where pm.project_id = p_project and pm.org_id = p_org and pm.user_id = (select auth.uid())
      and m.active and o.status = 'active'
      and (p_perm is null or p_perm = any (pm.permissions))
  );
$$;

-- ---------------------------------------------------------------------------
-- Money lives in its own table so it can be hidden per person.
-- ---------------------------------------------------------------------------
create table public.project_finance (
  project_id uuid not null,
  org_id uuid not null,
  contract_amount numeric(14, 2) not null default 0 check (contract_amount >= 0),
  billed_amount numeric(14, 2) not null default 0 check (billed_amount >= 0),
  primary key (project_id, org_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);

insert into public.project_finance (project_id, org_id, contract_amount, billed_amount)
select id, org_id, contract_amount, billed_amount from public.projects;

alter table public.projects drop column contract_amount, drop column billed_amount;

create function private.create_project_finance()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_finance (project_id, org_id) values (new.id, new.org_id);
  return new;
end;
$$;
create trigger projects_finance after insert on public.projects
  for each row execute function private.create_project_finance();

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
alter table public.project_members enable row level security;
alter table public.project_finance enable row level security;

drop policy org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
  using (private.belongs_to(id) or private.is_platform_admin());

drop policy profile_select on public.profiles;
create policy profile_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or private.is_platform_admin()
    or exists (select 1 from public.memberships m where m.user_id = profiles.id and private.is_admin(m.org_id))
  );
drop function private.shares_org(uuid);

-- Members see their own rows; admins see the firm's roster. Rows are created by the
-- accounts function. Admins turn non-owners on/off or change their role; nobody deletes.
drop policy membership_select on public.memberships;
drop policy membership_update on public.memberships;
drop policy membership_delete on public.memberships;
create policy membership_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(org_id) or private.is_platform_admin());
create policy membership_update on public.memberships for update to authenticated
  using (private.is_admin(org_id) and role <> 'owner' and user_id <> (select auth.uid()))
  with check (private.is_admin(org_id) and role <> 'owner' and user_id <> (select auth.uid()));

create policy project_member_select on public.project_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(org_id) or private.is_platform_admin());
create policy project_member_insert on public.project_members for insert to authenticated
  with check (private.is_admin(org_id));
create policy project_member_update on public.project_members for update to authenticated
  using (private.is_admin(org_id)) with check (private.is_admin(org_id));
create policy project_member_delete on public.project_members for delete to authenticated
  using (private.is_admin(org_id));

drop policy project_select on public.projects;
create policy project_select on public.projects for select to authenticated
  using (private.can(org_id, id) or private.is_platform_admin());

create policy finance_select on public.project_finance for select to authenticated
  using (private.can(org_id, project_id, 'money.view') or private.is_platform_admin());
create policy finance_update on public.project_finance for update to authenticated
  using (private.is_admin(org_id)) with check (private.is_admin(org_id));

-- Records: view / add / edit / delete per module.
drop policy labour_select on public.labour_entries;
drop policy labour_insert on public.labour_entries;
drop policy labour_update on public.labour_entries;
drop policy labour_delete on public.labour_entries;
create policy labour_select on public.labour_entries for select to authenticated
  using (private.can(org_id, project_id, 'labour.view') or private.is_platform_admin());
create policy labour_insert on public.labour_entries for insert to authenticated
  with check (private.can(org_id, project_id, 'labour.add'));
create policy labour_update on public.labour_entries for update to authenticated
  using (private.can(org_id, project_id, 'labour.edit')) with check (private.can(org_id, project_id, 'labour.edit'));
create policy labour_delete on public.labour_entries for delete to authenticated
  using (private.can(org_id, project_id, 'labour.delete'));

drop policy material_select on public.material_entries;
drop policy material_insert on public.material_entries;
drop policy material_update on public.material_entries;
drop policy material_delete on public.material_entries;
create policy material_select on public.material_entries for select to authenticated
  using (private.can(org_id, project_id, 'materials.view') or private.is_platform_admin());
create policy material_insert on public.material_entries for insert to authenticated
  with check (private.can(org_id, project_id, 'materials.add'));
create policy material_update on public.material_entries for update to authenticated
  using (private.can(org_id, project_id, 'materials.edit')) with check (private.can(org_id, project_id, 'materials.edit'));
create policy material_delete on public.material_entries for delete to authenticated
  using (private.can(org_id, project_id, 'materials.delete'));

drop policy vat_select on public.vat_bills;
drop policy vat_insert on public.vat_bills;
drop policy vat_update on public.vat_bills;
drop policy vat_delete on public.vat_bills;
create policy vat_select on public.vat_bills for select to authenticated
  using (private.can(org_id, project_id, 'bills.view') or private.is_platform_admin());
create policy vat_insert on public.vat_bills for insert to authenticated
  with check (private.can(org_id, project_id, 'bills.add'));
create policy vat_update on public.vat_bills for update to authenticated
  using (private.can(org_id, project_id, 'bills.edit')) with check (private.can(org_id, project_id, 'bills.edit'));
create policy vat_delete on public.vat_bills for delete to authenticated
  using (private.can(org_id, project_id, 'bills.delete'));

drop policy bbs_select on public.bbs_items;
drop policy bbs_insert on public.bbs_items;
drop policy bbs_update on public.bbs_items;
drop policy bbs_delete on public.bbs_items;
create policy bbs_select on public.bbs_items for select to authenticated
  using (private.can(org_id, project_id, 'steel.view') or private.is_platform_admin());
create policy bbs_insert on public.bbs_items for insert to authenticated
  with check (private.can(org_id, project_id, 'steel.add'));
create policy bbs_update on public.bbs_items for update to authenticated
  using (private.can(org_id, project_id, 'steel.edit')) with check (private.can(org_id, project_id, 'steel.edit'));
create policy bbs_delete on public.bbs_items for delete to authenticated
  using (private.can(org_id, project_id, 'steel.delete'));

drop policy boq_select on public.boq_items;
drop policy boq_insert on public.boq_items;
drop policy boq_update on public.boq_items;
drop policy boq_delete on public.boq_items;
create policy boq_select on public.boq_items for select to authenticated
  using (private.can(org_id, project_id, 'boq.view') or private.is_platform_admin());
create policy boq_insert on public.boq_items for insert to authenticated
  with check (private.can(org_id, project_id, 'boq.add'));
create policy boq_update on public.boq_items for update to authenticated
  using (private.can(org_id, project_id, 'boq.edit')) with check (private.can(org_id, project_id, 'boq.edit'));
create policy boq_delete on public.boq_items for delete to authenticated
  using (private.can(org_id, project_id, 'boq.delete'));

drop policy drawing_select on public.drawings;
drop policy drawing_insert on public.drawings;
drop policy drawing_update on public.drawings;
drop policy drawing_delete on public.drawings;
create policy drawing_select on public.drawings for select to authenticated
  using (private.can(org_id, project_id, 'drawings.view') or private.is_platform_admin());
create policy drawing_insert on public.drawings for insert to authenticated
  with check (private.can(org_id, project_id, 'drawings.add'));
create policy drawing_update on public.drawings for update to authenticated
  using (private.can(org_id, project_id, 'drawings.add')) with check (private.can(org_id, project_id, 'drawings.add'));
create policy drawing_delete on public.drawings for delete to authenticated
  using (private.can(org_id, project_id, 'drawings.delete'));

-- ---------------------------------------------------------------------------
-- Storage: "<org_id>/<project_id>/<file>". Receipts hold challans (materials) and bills.
-- ---------------------------------------------------------------------------
create function private.object_project(p_name text)
returns uuid language sql stable set search_path = '' as $$
  select case
    when (storage.foldername(p_name))[2] ~ '^[0-9a-f-]{36}$'
    then ((storage.foldername(p_name))[2])::uuid
  end;
$$;

drop policy drawings_read on storage.objects;
drop policy drawings_write on storage.objects;
drop policy drawings_delete on storage.objects;
drop policy receipts_read on storage.objects;
drop policy receipts_write on storage.objects;
drop policy receipts_delete on storage.objects;

create policy drawings_read on storage.objects for select to authenticated
  using (bucket_id = 'drawings' and (
    private.can(private.object_org(name), private.object_project(name), 'drawings.view') or private.is_platform_admin()));
create policy drawings_write on storage.objects for insert to authenticated
  with check (bucket_id = 'drawings' and private.can(private.object_org(name), private.object_project(name), 'drawings.add'));
create policy drawings_delete on storage.objects for delete to authenticated
  using (bucket_id = 'drawings' and private.can(private.object_org(name), private.object_project(name), 'drawings.delete'));

create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (
    private.can(private.object_org(name), private.object_project(name), 'materials.view')
    or private.can(private.object_org(name), private.object_project(name), 'bills.view')
    or private.is_platform_admin()));
create policy receipts_write on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (
    private.can(private.object_org(name), private.object_project(name), 'materials.add')
    or private.can(private.object_org(name), private.object_project(name), 'bills.add')));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (
    private.can(private.object_org(name), private.object_project(name), 'materials.delete')
    or private.can(private.object_org(name), private.object_project(name), 'bills.delete')));

-- ---------------------------------------------------------------------------
-- Column grants (see migration 2). Organizations, memberships and profiles rows are
-- created only by the accounts function (service role).
-- ---------------------------------------------------------------------------
revoke insert, update on public.platform_admins, public.project_members, public.project_finance from anon, authenticated;
grant insert (project_id, org_id, user_id, permissions) on public.project_members to authenticated;
grant update (permissions) on public.project_members to authenticated;
grant update (contract_amount, billed_amount) on public.project_finance to authenticated;
grant update (active) on public.memberships to authenticated;
grant update (must_change_password) on public.profiles to authenticated;

grant execute on all functions in schema private to authenticated;
