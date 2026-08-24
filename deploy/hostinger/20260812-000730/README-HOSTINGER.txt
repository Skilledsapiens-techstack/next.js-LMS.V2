Hostinger upload package for Skilled Sapiens LMS

Upload target:
- Extract the ZIP contents directly into public_html, or the target subdomain document root.
- index.html, assets/, favicon files, and .htaccess must sit directly inside that root.

Important:
- Do not upload the project source, node_modules, .env, or supabase folders to Hostinger.
- This is a static Vite SPA build. Supabase and Edge Functions remain hosted on Supabase.
- .htaccess is included for React Router deep links such as /admin/email-marketing.

Verification after upload:
- Open /
- Open /login
- Open /admin/email-marketing after logging in as admin
- Refresh a deep route and confirm it does not show a 404
