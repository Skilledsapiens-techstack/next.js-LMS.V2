# Hostinger Staging Deployment Notes

## What to upload

Upload the contents of the `public_html` folder from this package into the Hostinger staging domain or staging subdomain document root.

Do not upload the source repository, `.env`, `node_modules`, `supabase`, or any service-role secrets to Hostinger.

## Required Supabase settings

- Add the staging URL to Supabase Auth allowed redirect URLs.
- Add the staging URL to Supabase Site URL or additional redirect URLs as appropriate.
- Keep only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_WRITE_ACTIONS_ENABLED=true` in frontend build-time env.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only in Supabase Edge Function secrets. Never expose it through `VITE_*`.

## Hostinger settings

- Enable HTTPS/SSL for the staging domain before QA.
- Keep the included `.htaccess` file in the web root so React routes refresh correctly.
- Upload hidden files too; `.htaccess` is required.

## Smoke test after upload

- Open `/login`.
- Log in as admin and student test users.
- Refresh deep routes such as `/admin/resources` and `/student/resources`.
- Verify admin write actions on staging only.
- Verify paid/locked resource behavior.
- Verify Zoom Edge Function actions if testing Schedule Meeting.
