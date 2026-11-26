# Implementation plan

Scope = the CEO's prototype (7 pages + login with Admin / Site Staff), made real, multi-tenant, with a better design.

## Phases

### Phase 0 — Foundation ✅
- [x] Vite + React + TS + Tailwind + Router + Supabase client, oxlint, Vitest
- [x] Dev Supabase connected (`.env.local`), migrations via Supabase CLI

### Phase 1 — Backend ✅
- [x] Schema: organizations, profiles, memberships, invites, projects, drawings, boq_items, bbs_items, material_entries, labour_entries, vat_bills, project_summaries view
- [x] RLS on every table, roles owner/admin/site_staff, composite FKs for tenant safety
- [x] RPCs: create_organization, accept_invite
- [x] Storage buckets `drawings`, `receipts` with tenant-folder policies
- [x] RLS integration tests (10/10 passing on dev, 2026-11-26)

### Phase 2 — Auth & app shell ✅ (owner role browser-tested)
- [x] Supabase client, auth context, protected routes (guest/auth/org guards)
- [x] Sign up, log in, log out, forgot + reset password
- [x] Onboarding: create firm, or join with invite code
- [x] App shell: sidebar (desktop) / drawer + bottom tabs (mobile), project switcher, light/dark
- [x] Projects: list, create, edit, delete (admin) incl. storage cleanup
- [x] Site Hub: information board, billing update, record summary, money so far
- [x] Browser: login/signup render, light+dark, no overflow at 320/375, no console errors
- [x] Browser (owner): redirect to last project, Site Hub board + summary match DB, sidebar project menu hidden for unknown project ids
- [x] Browser (site staff, real login): no delete buttons on any page, no BOQ add, no drawing upload, no project edit/billing, no invite panel or role selects; can add labour/delivery/bill/steel; can leave firm; staff-worded empty states. Saved a labour row as staff → created_by = staff, wage computed by DB

### Phase 3 — Modules ✅ (owner role browser-tested)
- [x] Site Hub dashboard (built in phase 2)
- [x] Labour (form + live wage, date/category filters in URL, totals, print)
- [x] Materials (form, challan photo upload, material filter in URL, print)
- [x] VAT bills (form, 13% preview, PAN check, duplicate bill message, bill upload, totals, print)
- [x] Steel / BBS (inline calculator, totals by diameter, print)
- [x] BOQ (search in URL, add item (admin), stable SN, grand total, print)
- [x] Drawings (category tabs in URL, upload (admin), open via signed URL, delete with file)
- [x] Browser (owner): labour add/filter/delete; challan upload → signed view → delete removes file; drawing upload (no-file error, category tab URL) → delete; VAT PAN pattern + duplicate bill message; BOQ search ignores dots ("pcc" finds P.C.C.)
- [x] Shared: Ledger (table on desktop / list on phone), admin-only delete with confirm, uploads cleaned up on failed save and on delete

### Phase 4 — Team ✅ (owner role browser-tested)
- [x] Members with roles, change role, remove member (admin), leave firm (non-owner)
- [x] Invite codes: create per role, copy, share, revoke; join via onboarding
- [x] Browser (owner): create + revoke invite, member list with role select

### Phase 5 — Polish & release readiness
- [x] Code-split module + team routes (entry 588 kB / 172 kB gzip: React + Supabase client; pages 5–7 kB each)
- [x] Print/PDF report layouts: Labour, Materials, Bills, Steel, BOQ checked by applying the app's print CSS at A4 width (794 px): report header, no buttons/filters/nav/delete column; file-link columns hidden on paper; bill no. kept on one line; steel total panel prints black-on-white. A real Ctrl+P look is still worth one pass (page margins, browser headers)
- [x] Responsive pass 320/375/768/1024/1366: no horizontal scroll; phone ledger rows drop the amount under long text; money never splits mid-number; long project codes wrap
- [x] Dark mode checked at 320
- [x] a11y pass: skip-to-content link; keyboard walk (dialog takes focus, Esc closes, focus returns to its button); every control on all 9 app pages has an accessible name; phone tap targets ≥ 44 px (Site Hub board buttons and onboarding tabs raised from 40 px)
- [x] Empty states seen (drawings, BOQ search), skeletons on every list, ErrorState with retry on every page. Error path tested with a faked 503 on labour: after the Supabase client's own retries (~10 s) a friendly error shows (no raw server text), and "Try again" loads the data once the server is back
- [x] Column-level grants: no forged created_by, no moving rows between firms, no email spoofing (migration 2, tested)
- [x] Mobile drawer is a native modal dialog (Esc, focus trap); confirm dialogs mount only when open
- [x] Production steps written: docs/DEPLOY.md
- [ ] Production deploy — needs user (company Supabase account + hosting choice)

### Phase 6 — Production readiness
- [x] My profile page (`/profile`, linked from the sidebar): edit name, change password (with confirm field), list firms with role + switch. Tested: name save shows in Team, mismatch message; real password change left to the user
- [x] Edit saved records (owner/admin only, pencil next to delete) on Labour, Materials, VAT bills, Steel, BOQ. Photos stay as they are when editing. Tested each in the browser: prefilled form, DB recalculates wage/VAT/weight/amount, totals update; values restored after
- [x] Edit project, update billing, delete project tested in the browser. Delete on a throwaway project removed its rows and its stored file
- [x] Fixed: "Delete this project" did nothing (the edit dialog's close event cancelled the confirm dialog). Fix is in the shared Modal
- [x] App name and role labels in one place (`src/lib/brand.ts`), so the rebrand is one line (+ `<title>` in index.html)
- [x] DB review: RLS on all 11 tables; security-definer functions pin search_path; `private` schema not usable by anon; every record table has a project_id-leading index (lists + cascade deletes). `created_by`/`accepted_by` FKs left unindexed on purpose (only hit when a user account is deleted, which the app doesn't offer)
- [x] Migration 3 (`touch_updated_at` pins search_path, Supabase advisor warning) applied to dev with the user's OK; trigger checked, `pnpm test:db` 12/12
- [ ] Brand name — waiting on the user/CEO choice
- [ ] Sign up → confirm email → onboarding (create firm / join with code) through the real screens — needs the user to sign up a fresh test account, and Supabase Auth redirect URLs set
- [ ] SMTP for auth emails (Supabase's built-in sender only allows a few emails per hour — not enough for the demo)
- [ ] Production Supabase project + hosting (see docs/DEPLOY.md)

## Open decisions (user / CEO)
- Money additions inside existing pages (material amount + paid/due, labour advance, client payments on Site Hub). Not built until approved.
- BS (Bikram Sambat) dates in the UI.
- Supabase Auth "Confirm email" setting and SMTP provider for the dev/prod projects.
- Brand name (replaces "Nirman Sathi").

## Blockers
- Supabase Auth → URL Configuration: add `http://localhost:5173/**` to Redirect URLs (email confirm + password reset links), and set Site URL.

## Test log
- 2026-11-26 (run 9): DB review (indexes, RLS, function security); migration 3 applied to dev (user OK).
- 2026-11-26 (run 8): profile page, record editing on 5 pages, project edit/billing/delete tested in the browser; Modal bug fixed; `pnpm test` 7/7, `pnpm test:db` 12/12, `tsc -b` clean, build OK.
- 2026-11-26 (run 7): error + retry state tested with a faked 503 (tab only).
- 2026-11-26 (run 6): print layouts checked via simulated print CSS (see Phase 5); `tsc -b` clean.
- 2026-11-26 (run 5): site staff role tested with a real staff login (see Phase 2); test row removed.
- 2026-11-26 (run 4): a11y pass (see Phase 5); `pnpm test` 4/4, `tsc -b` clean, lint clean.
- 2026-11-26 (run 3): owner flows in the browser (see phases 2–4), no console errors; `pnpm test` 4/4, `pnpm test:db` 12/12, `tsc -b` clean, build OK. Test rows created during the run were deleted; storage back to 0 objects.
- 2026-11-26 (run 2): `pnpm test:db` 12/12 after column grants.
- 2026-11-26: `pnpm test:db` 11/11 (+ dashboard summary), `pnpm test` 4/4, `tsc -b` clean, oxlint clean (only fast-refresh hints), `pnpm build` OK.
- 2026-11-26: `pnpm test:db` 10/10 — roles, DB math, cross-tenant read/write, storage scoping.
