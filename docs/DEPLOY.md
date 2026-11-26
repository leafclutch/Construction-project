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
This creates every table, RLS policy, column grant, RPC and both storage buckets. Never run `supabase/seed.sql` or tests against prod.

## 3. Auth settings (dashboard, not in migrations)
- Authentication → URL Configuration: Site URL = the live domain; Redirect URLs = `https://<domain>/**`.
- Authentication → Email: keep **Confirm email ON**.
- Authentication → SMTP: connect a real email sender (Resend, SES, …). The built-in sender only allows a few mails per hour.
- Password minimum length: 8 (the app asks for 8).

## 4. Hosting
Any static host works (Vercel, Netlify, Cloudflare Pages).
- Build command `pnpm build`, output folder `dist`.
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` from the **prod** project. Nothing else. Never the secret key.
- SPA fallback: every path must serve `index.html` (Vercel/Netlify/Cloudflare do this with a one-line rewrite rule).

## 5. Smoke test on prod
Sign up → create firm → create project → add one row in each module (with a photo) → invite code → second account joins as site staff → staff cannot delete → print a page.
