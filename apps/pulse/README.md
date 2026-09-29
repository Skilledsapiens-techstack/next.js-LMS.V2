# Pulse App

This is the separate Pulse app shell.

It currently shares:
- the same Supabase project/database
- the same Supabase Auth session model
- Skilled Sapiens branding and assets from `public/`
- Pulse product pages from `src/pulse`
- the LMS handoff link through `VITE_LMS_APP_URL`

Useful commands from the repository root:

```bash
npm run dev:pulse
npm run build:pulse
npm run preview:pulse
```

The separate build outputs to `dist-pulse/`.

For local testing, use:

```bash
VITE_LMS_APP_URL=http://127.0.0.1:5173 npm run dev:pulse
```

For production, set:

```bash
VITE_LMS_APP_URL=https://login.skilledsapiens.com
```
