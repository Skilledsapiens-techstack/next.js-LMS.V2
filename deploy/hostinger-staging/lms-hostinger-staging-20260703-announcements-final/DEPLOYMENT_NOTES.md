# Skilled Sapiens LMS Hostinger Staging Package

Package: `lms-hostinger-staging-20260703-announcements-final`

Build verification:
- `npm run build` passed.
- Generated from the latest local frontend state, including the announcement module updates.
- Source git base: `082ff39` plus current local changes.

Upload instructions:
1. Open Hostinger File Manager for `dev.skilledsapiens.com`.
2. Go to `public_html`.
3. Upload the contents of `public_html` from this package.
4. Replace old `index.html`, `.htaccess`, and `assets`.
5. Clear browser cache or hard refresh after deployment.

Important:
- This package is static frontend only.
- No `.env` file is included.
- No Supabase service-role key or private credentials are included.
- Frontend only uses public runtime values that Vite embeds during build.

Included latest updates:
- Admin announcement exact recipient count preview.
- Admin announcement create/edit/archive/status workflows.
- Row duplicate draft action and bulk archive.
- Lightweight rich announcement formatting and preview.
- Student announcement bell with active visible count.
- Student pinned/urgent announcement banner.
- Student-side formatted announcement rendering.
