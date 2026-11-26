# Nirman Sathi — project guide

Leafclutch project (not Yeti Code Crew). A SaaS for Nepali thekedars (construction contractors) to keep every site record in one place. The CEO's Gemini prototype "Nirman Sathi" is the feature spec; the design is ours to improve. It will be demoed at a thekedar meeting in Kathmandu (~late Dec 2026).

Plan, checklist, test results and blockers: `docs/PLAN.md`. Keep it in sync with reality.

## Stack (decided)
- Vite + React 19 + TypeScript + Tailwind v4 + React Router. pnpm.
- Supabase is the whole backend: Postgres (constraints, generated columns, RLS, RPCs), Auth (email + password), Storage. No custom server.
- Lint: oxlint. Tests: Vitest — `pnpm test` (unit, `src/`), `pnpm test:db` (RLS integration against the dev project, `tests/`).

## Environments
- Dev = the user's personal Supabase project. Keys in `.env.local` (gitignored). Prod comes later on the company account.
- Schema lives only in `supabase/migrations/*.sql`. Never change the DB from the dashboard.
- Apply: `pnpm db:push --dry-run`, then `pnpm db:push`. Production steps: `docs/DEPLOY.md`.
- Browser code may only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY` is for tests/scripts only.

## Architecture rules
- Tenant = `organizations` (a thekedar firm). Every business table has `org_id` + RLS via `private.is_member` / `private.is_admin`. Child tables FK `(project_id, org_id)` → `projects(id, org_id)` so rows can't point across tenants.
- Roles: `owner` (signed up / created org), `admin`, `site_staff`. Staff can read everything in the org and add site records (material, labour, VAT bills, BBS); only owner/admin edit or delete, manage projects, drawings, BOQ and team.
- Money and quantity math (BOQ amount, wage, VAT 13%, steel D²/162) is done by generated columns in Postgres; the UI only previews it.
- Storage: private buckets `drawings`, `receipts`; object path `<org_id>/<project_id>/<file>`; view through signed URLs.
- Column-level grants (migration 2): clients may only write data columns. A new table or column needs an explicit `grant insert/update (cols)`, or writes fail with 42501.
- Any new table: org_id, composite FK, RLS policies, column grants, and a case in `tests/rls.integration.test.ts`.
- DB scripts: `pnpm db:push [--dry-run]`, `pnpm gen:types` (both read `.env.local`).

## Product rules
- The product name lives in `src/lib/brand.ts` (`APP_NAME`) and `<title>` in `index.html`. Never hard-code it elsewhere.
- Record edits (owner/admin) reuse the add form with `initial`; saves go through `updateOne(...select('id'))` so an RLS-blocked update errors instead of silently doing nothing.
- NPR shown in Nepali grouping (Rs. 1,79,42,326.00) via `src/lib/format.ts`.
- Mobile-first: site staff use phones. Every async screen has loading (same-size skeleton), error with retry, and empty states.
- Theme tokens only (light + dark).
