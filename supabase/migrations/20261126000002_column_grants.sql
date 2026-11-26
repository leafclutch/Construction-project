-- Column-level write grants. RLS decides *which rows* a user may write;
-- these decide *which columns*. Tenancy keys (org_id, project_id), audit
-- columns (created_by, created_at) and ids can no longer be set or changed
-- by clients, so entries can't be attributed to someone else or moved
-- between firms.

revoke insert, update on
  public.organizations, public.profiles, public.memberships, public.invites, public.projects,
  public.drawings, public.boq_items, public.bbs_items, public.material_entries,
  public.labour_entries, public.vat_bills
from anon, authenticated;

-- Inserts: tenancy keys + data. created_by always comes from auth.uid().
grant insert (org_id, role) on public.invites to authenticated;
grant insert (org_id, name, code, location, client_name, contract_amount, billed_amount, status, start_date)
  on public.projects to authenticated;
grant insert (org_id, project_id, title, category, file_path, file_name, file_size, mime_type) on public.drawings to authenticated;
grant insert (org_id, project_id, description, unit, quantity, rate) on public.boq_items to authenticated;
grant insert (org_id, project_id, member, bar_dia_mm, bar_count, cut_length_m) on public.bbs_items to authenticated;
grant insert (org_id, project_id, entry_date, material, quantity, unit, supplier, challan_path) on public.material_entries to authenticated;
grant insert (org_id, project_id, entry_date, category, worker_count, daily_rate, remarks) on public.labour_entries to authenticated;
grant insert (org_id, project_id, bill_date, bill_no, supplier_name, supplier_pan, taxable_amount, vat_included, file_path)
  on public.vat_bills to authenticated;

-- Updates: data columns only.
grant update (name) on public.organizations to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (role) on public.memberships to authenticated;
grant update (name, code, location, client_name, contract_amount, billed_amount, status, start_date) on public.projects to authenticated;
grant update (title, category) on public.drawings to authenticated;
grant update (description, unit, quantity, rate) on public.boq_items to authenticated;
grant update (member, bar_dia_mm, bar_count, cut_length_m) on public.bbs_items to authenticated;
grant update (entry_date, material, quantity, unit, supplier) on public.material_entries to authenticated;
grant update (entry_date, category, worker_count, daily_rate, remarks) on public.labour_entries to authenticated;
grant update (bill_date, bill_no, supplier_name, supplier_pan, taxable_amount, vat_included) on public.vat_bills to authenticated;

-- invites.created_by now always defaults to auth.uid(); keep the policy simple.
drop policy invite_insert on public.invites;
create policy invite_insert on public.invites for insert to authenticated
  with check (private.is_admin(org_id));
