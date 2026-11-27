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
- [x] Brand name: **Thekka** (chosen by the user). Note: a tender-notice app "ThekkaBazar" exists in Nepal; domain availability not checked yet
- [x] ~~Sign up / email confirm / invite codes~~ replaced by the managed model (Phase 7). No SMTP needed: no email is ever sent
- [ ] Production Supabase project + hosting (see docs/DEPLOY.md)

### Phase 7 — Managed SaaS + per-project permissions (user decision 2026-11-27)
Thekka is run by Leafclutch: super admins create firms and owner logins; owners create staff and choose, per project, what each person can do. No public signup, no email verification.
- [x] Migration 4: `platform_admins`, `organizations.status` (pause a firm), `memberships.active` (turn a person off), `profiles.must_change_password`, `project_members` (per-project permission list, checked by the DB), money moved to `project_finance` (needs `money.view`). Every policy rewritten around `private.can(org, project, perm)`; super admin reads everything, writes nothing. Invites, `accept_invite`, `create_organization` removed
- [x] Edge Function `accounts` (deployed to dev): create_firm, set_firm_status, create_staff, reset_password. Checks the caller first; accounts are created already confirmed; 12-character temporary passwords; undo on failure
- [x] Tests: `pnpm test:db` 30/30 — project scoping, each toggle, money hidden, staff can't see other staff, turned-off member, paused firm, super admin read-only, tenant isolation, storage by permission, function called as super admin / owner / staff (403), duplicate email (409)
- [x] `pnpm test` 11/11 incl. the app's permission list = the DB's list (read from the migration)
- [x] First login with a temporary password forces "Set your password"
- [x] Signup, onboarding, forgot/reset password pages removed; login says to ask the owner (or support) for a reset
- [x] Staff page (`/staff`): search, add staff (optionally straight onto a project with toggles), copy/share login details, reset password, turn access off/on, owner changes role
- [x] Project → Team (`/p/:id/team`): pick from staff (searchable) or create a new person, permission toggles with presets (Site supervisor, Store keeper, Accountant, Viewer) + See money, edit, remove
- [x] Super admin (`/platform`): firms list with search, new firm (owner login shown once + copy), pause/turn on, reset owner password, open a firm read-only (banner, no edit buttons, DB blocks writes)
- [x] Menus, buttons and pages follow the permissions (module pages show "no access" when view is off; money hidden on Site Hub and project list)
- [x] Sidebar stays the same on every page (keeps the last opened project's menu); styled project dropdown with search and arrow keys
- [x] Browser: site staff with no project sees "not added yet", cannot open Staff or a project by URL
- [x] Browser (owner): Staff page, Team tab add-from-staff with Store keeper preset, toggle rules (add turns on view; view off clears the row), new person with taken email (clear message) and new email (login card, copy works), turn access off/on, new project with contract amount → billing → delete (money row removed with it). Fixed: double scrollbar in tall dialogs (shared Modal); sidebar now falls back to the only project
- [x] Browser (new staff, Site supervisor): first login forced "Set your password" (flag cleared in DB); sees only the assigned project, no money on the board, no Team/Staff (pages say "no access" by URL too), Labour add + edit but no delete, BOQ view only; edit saved through RLS. Phone 375: no sideways scroll, bottom tabs Hub/Labour/Materials/Bills/More
- [x] Browser (super admin): lands on Firms; create firm + owner login (card + copy); open a firm read-only (banner; no add/edit/delete on Site Hub, Labour, Team, Staff); pause (badge, toast) and turn back on; reset owner password. Fixed: the password card after a reset said "Firm created"/"Login created" (now "New temporary password"); admin header now stays on one row at 320 px and the firm search placeholder is no longer cut off
- [x] Top bar on every page: breadcrumb (Home › Project › Section; Home = projects list) and an avatar menu (name, role · firm, My profile, Dark/Light mode, Log out). Removed those three from the sidebar; sidebar sections share one 10px gap and desktop rows are 32px (phones keep 44px), so the menu fits a ~600px tall window with no scroll; thin sidebar scrollbar. Same avatar menu in the super admin header. Profile page: identity card + name/password side by side on desktop; firm list only with 2+ firms. Browser-tested as owner (desktop, 320, 375, dark) and super admin (admin header menu, profile, menu while viewing a firm read-only)
- [ ] Profile photos (upload): not built; needs a storage bucket + column. Avatar shows initials

### Phase 8 — Installable app (PWA), offline first (user decision 2026-11-27)
Most people will use Thekka as an app on Android phones with weak signal on site.
- [x] Migration 5 (dev): client ids allowed on the 4 add-able tables, `push_subscriptions` (own rows only, saved through `save_push_subscription`), `pg_net` trigger that calls the `push` function for site_staff inserts. Function `push` deployed to dev with VAPID + secret; Vault rows set
- [x] Tests: `pnpm test:db` 35/35 (double insert with the same id = one row, push subscription RLS, trigger fires only for staff); `tests/push.integration.test.ts` (secret check)
- [x] Manifest, icons (192/512/maskable/apple), service worker (precache, SPA fallback, push, notification click opens the record page), update banner, theme-color follows light/dark
- [x] Offline viewing: lists cached on the phone per user (IndexedDB), login works offline from the last loaded firm
- [x] Offline adding (browser-tested as staff on the prod build, offline faked by failing Supabase requests in the tab): labour, materials (with challan photo), bills (with photo), steel. Saved on the phone, uploaded in order when signal returns; status strip under the top bar; "On this phone, not uploaded yet" list on each page with Retry/Discard; log out warns before deleting unsent entries
- [x] Phone UI (browser-tested as support at 320/375 and staff at 375, light + dark): app bar with back arrow + page title, bottom tabs on every page with a raised + (quick add sheet using the same forms), home-screen shortcuts (Add labour / Add material), pull to refresh, page cross-fade, no tap flash / bounce
- [x] Camera: "Take photo" opens the back camera; photos shrunk to 1600 px JPEG before saving (drawings untouched)
- [ ] Install (built; needs the prod build test): card on Projects/Site Hub (phones, hide for 14 days), "Install app" in the avatar menu, iPhone Share → Add to Home Screen steps
- [x] Push in the app (browser-tested in Brave desktop on the prod build): profile toggle "Notifications on this phone" (owner/admin), card after install, unsubscribed on log out
- [ ] Real Android phone test (needs an https URL)

## Open decisions (user / CEO)
- Money additions inside existing pages (material amount + paid/due, labour advance, client payments on Site Hub). Not built until approved.
- BS (Bikram Sambat) dates in the UI.

## Blockers
- Supabase dashboard (dev): Authentication → Sign In / Providers → turn off "Allow new users to sign up". Safe either way (a self-signed-up account belongs to no firm and sees nothing), but it should be off.

## Test log
- 2026-11-27 (run 12): PWA. `pnpm test` 19/19, `tsc -b` clean, lint only old hints, build precaches 35 files. Prod preview: service worker active, app opens with the server stopped. Dev as support at 320/375: app bar, tabs, offline strip, dark mode, no sideways scroll. Update banner: a new build showed "A new version of Thekka is ready", Reload activated it. Fixed: empty gap above title-only pages on phones.
- 2026-11-27 (run 13): PWA as Hari (staff) on the prod build at 375, offline faked in the tab. + sheet shows exactly his 4 add permissions. Offline: labour + VAT bill with a 3.3 MB photo (shrunk to 807 KB, thumbnail) saved on the phone; Bills page opened offline from the cache with the pending panel; back online both uploaded by themselves, DB has exactly 1 row each and the photo at `<id>-name`; trigger called `push` (200). Log out with an unsent entry shows the warning (Cancel focused); after Cancel + online it uploaded. Log out clears cached lists and login data. Staff don't see the notifications toggle. Fixed: "2 entrys" → "2 entries". Owner (Sita) notification toggle in Brave: permission granted but Brave's push service refuses; the app now says so clearly instead of "Something went wrong". With Brave's push setting on: Sita subscribed (saved in `push_subscriptions`); a staff labour row in another firm (RAR) → function `{sent:0}`, so no cross-firm notification. Log out removed Sita's subscription. Owner of RAR turned it on; a staff labour row → `{sent:1}` and the phone showed "Labour added · Area Police Office, Duhabi — Hari Test: 4 × Mason" linking to the Labour page. Home-screen shortcut `/?add=labour` opens the project with "Add labour" and drops `?add` from the URL. Install card renders when Brave offers install (DOM-checked; hidden on desktop by design; the window couldn't be resized to see it at phone width); "Install app" shows in the avatar menu.
- 2026-11-27 (run 11): top bar + breadcrumb + avatar menu, profile page redesign. `pnpm test` 11/11, `tsc -b` clean, build OK, lint only old hints. Browser as owner: desktop, 320/375, dark, keyboard in the menu, no console errors.
- 2026-11-27 (run 10): managed SaaS model (Phase 7). Migration 4 + accounts function on dev; `pnpm test:db` 30/30, `pnpm test` 11/11, `tsc -b` clean, lint only old fast-refresh hints.
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
