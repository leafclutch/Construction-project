# Thekka — project guide

Leafclutch project (not Yeti Code Crew). A SaaS for Nepali thekedars (construction contractors) to keep every site record in one place. Product name: **Thekka** (ठेक्का, "contract"). The CEO's Gemini prototype "Nirman Sathi" is the feature spec; the design is ours to improve. It will be demoed at a thekedar meeting in Kathmandu (~late Dec 2026).

Plan, checklist, test results and blockers: `docs/PLAN.md`. Keep it in sync with reality.

## Stack (decided)
- Vite + React 19 + TypeScript + Tailwind v4 + React Router. pnpm.
- Supabase is the whole backend: Postgres (constraints, generated columns, RLS), Auth (email + password), Storage, and one Edge Function `accounts` (creating logins and resetting passwords needs the service key). No other server.
- Lint: oxlint. Tests: Vitest — `pnpm test` (unit, `src/`), `pnpm test:db` (RLS integration against the dev project, `tests/`).

## Environments
- Dev = the user's personal Supabase project. Keys in `.env.local` (gitignored). Prod comes later on the company account.
- Schema lives only in `supabase/migrations/*.sql`. Never change the DB from the dashboard.
- Apply: `pnpm db:push --dry-run`, then `pnpm db:push`. Production steps: `docs/DEPLOY.md`.
- Browser code may only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY` is for tests/scripts only.

## Architecture rules
- Managed SaaS, no public signup and no emails. Leafclutch super admins (`platform_admins`) create firms + owner logins at `/platform`; owners/admins create staff logins. New logins get a temporary password and must set their own on first login (`profiles.must_change_password`). Resets are done by the owner (staff) or super admin (owners).
- Tenant = `organizations` (a thekedar firm, `status` active/suspended). Every business table has `org_id`. Child tables FK `(project_id, org_id)` → `projects(id, org_id)` so rows can't point across tenants.
- Roles: `owner`, `admin` see and do everything in their firm. `site_staff` see only projects they are in (`project_members`), with per-project permissions `<module>.view|add|edit|delete` (drawings: view|add|delete) and `money.view`. The list lives in `src/lib/permissions.ts` and the check constraint in migration 4; a unit test keeps them equal.
- RLS: records use `private.can(org_id, project_id, '<perm>')`; every select also allows `private.is_platform_admin()` (support reads, never writes). `memberships.active = false` or a suspended firm cuts all access.
- Money (contract, billed) lives in `project_finance`, readable only with `money.view`.
- Money and quantity math (BOQ amount, wage, VAT 13%, steel D²/162) is done by generated columns in Postgres; the UI only previews it.
- Storage: private buckets `drawings`, `receipts`; object path `<org_id>/<project_id>/<file>`; view through signed URLs.
- Column-level grants (migration 2): clients may only write data columns. A new table or column needs an explicit `grant insert/update (cols)`, or writes fail with 42501.
- Any new table: org_id, composite FK, RLS policies, column grants, and a case in `tests/rls.integration.test.ts`. A new module also needs its permissions in both lists.
- UI permissions: `useProject().can(perm)` inside project pages, `useCanOn(project)` elsewhere; row buttons take `module`. Hide what isn't allowed; the DB enforces it anyway.
- Edge Function: `pnpm exec supabase functions deploy accounts --remote=<ref> --no-verify-jwt --use-api` (needs the user's OK for each target). Tests: `tests/accounts.integration.test.ts`.
- DB scripts: `pnpm db:push [--dry-run]`, `pnpm gen:types` (both read `.env.local`).

## Product rules
- The product name lives in `src/lib/brand.ts` (`APP_NAME`) and `<title>` in `index.html`. Never hard-code it elsewhere.
- Record edits (owner/admin) reuse the add form with `initial`; saves go through `updateOne(...select('id'))` so an RLS-blocked update errors instead of silently doing nothing.
- NPR shown in Nepali grouping (Rs. 1,79,42,326.00) via `src/lib/format.ts`.
- Mobile-first: site staff use phones. Every async screen has loading (same-size skeleton), error with retry, and empty states.
- Theme tokens only (light + dark).
