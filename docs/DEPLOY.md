# Going to production

Nothing here has been run yet. Each step needs the owner's go-ahead.

## 1. Production Supabase project
- Create it under the **company (Leafclutch) account**, on a paid plan. Free projects pause after a week idle, which would break a live demo.
- Region: pick the one closest to Nepal (dev uses `ap-northeast-1`; `ap-south-1` Mumbai is closer).

## 2. Schema
```bash
# Use the prod session-pooler URL (port 5432), never the dev one.
pnpm exec supabase db push --db-url "<prod session pooler URL>" --dry-run
pnpm exec supabase db push --db-url "<prod session pooler URL>"
```
This creates every table, RLS policy, column grant and both storage buckets. Never run tests against prod.

## 3. Edge Function
```bash
pnpm exec supabase functions deploy accounts --remote=<prod ref> --no-verify-jwt --use-api
```
`--no-verify-jwt` is intended: the function checks the caller's login itself (works with the new JWT signing keys). It uses the project's own service key, which Supabase gives it automatically; nothing to configure.

### Push notifications (function `push`)
Generate VAPID keys once per environment: `pnpm dlx web-push generate-vapid-keys`.
```bash
pnpm exec supabase functions deploy push --remote=<prod ref> --no-verify-jwt --use-api
pnpm exec supabase secrets set --project-ref <prod ref> VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… PUSH_SECRET=<long random string>
```
Then in the SQL editor (migration 5 already enabled `pg_net`; the trigger does nothing until these exist):
```sql
select vault.create_secret('https://<prod ref>.supabase.co/functions/v1/push', 'push_url');
select vault.create_secret('<same PUSH_SECRET>', 'push_secret');
```
The app needs `VITE_VAPID_PUBLIC_KEY` (the public key) at build time.

## 4. Auth settings (dashboard, not in migrations)
- Authentication → Sign In / Providers → **turn off "Allow new users to sign up"**. Logins are created only by the accounts function.
- Password minimum length: 8 (the app asks for 8).
- No SMTP and no redirect URLs needed: the app never sends email.

## 5. First super admin
Create the user in the dashboard (Authentication → Users → Add user, "Auto confirm"), then in the SQL editor:
```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = '<their email>';
```
They log in and land on `/platform`, where they create firms.

## 6. Hosting
Any static host works (Vercel, Netlify, Cloudflare Pages).
- Build command `pnpm build`, output folder `dist`.
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY` from the **prod** project. Nothing else. Never the secret key.
- HTTPS is required: the service worker, install and push only work on https (or localhost).
- Don't cache `sw.js` and `index.html` long (`Cache-Control: no-cache`), or phones get updates late. Hashed `assets/*` can be cached forever.
- SPA fallback: every path must serve `index.html` (Vercel/Netlify/Cloudflare do this with a one-line rewrite rule).

## 7. Smoke test on prod
Super admin creates a firm → owner logs in with the temporary password and sets their own → owner creates a project → owner adds a staff member to it with the "Store keeper" preset → staff logs in, sets a password, sees only that project and only Materials/Bills → add one row in each module (with a photo) as the owner → print a page. Delete the test firm afterwards.
