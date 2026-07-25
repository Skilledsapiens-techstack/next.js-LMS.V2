# Hostinger Package: Career Readiness RTE

Built from the current workspace after the Career Readiness custom-section and rich-text editor update.

## Contents

- `dist/` - production frontend build for Hostinger upload.
- `supabase/migrations/20260722183304_career_readiness_content.sql` - base Career Readiness content table, policies, RPC, and feature flag.
- `supabase/migrations/20260722185325_career_readiness_custom_sections.sql` - custom section titles and flexible category keys.

## QA Completed

- TypeScript typecheck
- ESLint
- Production build
- Full Jest suite
- Real Supabase admin/student auth flow for custom rich-text Career Readiness content
