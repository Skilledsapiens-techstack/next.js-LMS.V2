# LMS Hostinger Staging Package - Student Live Project Roles

Build date: 2026-07-10

## Contents

- `public_html/` contains the production frontend build from `npm run build`.
- Adds optional student tracking field: `Live Project Role`.
- Uses active Admin Project Roles from `role_master` as the source list.
- Stores canonical role IDs in `students.live_project_role_ids`.
- Displays readable role names on:
  - Admin student roster
  - Student detail modal
  - Student create/edit intake form
  - Student import preview/editor
  - Student export CSV
- Import accepts either role names or role IDs.
- Import preserves unknown role values during preview validation, including mixed valid/invalid role lists, so admins see an error instead of silent role drops.
- Export writes readable role names.

## Backend Notes

- Supabase migration applied:
  - `20260710103219_add_student_live_project_roles.sql`
- Added column:
  - `public.students.live_project_role_ids text[] not null default '{}'::text[]`
- Added GIN index:
  - `students_live_project_role_ids_gin`
- This field is tracking/display only. It does not change student-side project visibility, access rules, submissions, cohorts, programs, or certificate logic.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Linked Supabase schema verification passed: `live_project_role_ids` exists on `public.students`.
- Live write regression used the test student `skilledsapiens@gmail.com`:
  - patched one active role ID
  - verified readback
  - restored the exact original value
  - final verification showed `live_project_role_ids = []`
- No student access or project eligibility logic was changed.
