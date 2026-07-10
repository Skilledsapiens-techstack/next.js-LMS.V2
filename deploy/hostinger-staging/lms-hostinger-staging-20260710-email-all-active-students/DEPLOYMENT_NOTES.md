# LMS Hostinger Staging Package - Email Centre All Active Students

Build date: 2026-07-10

## Contents

- `public_html/` contains the production frontend build from `npm run build`.
- Adds Admin Email Centre recipient mode: `All active LMS students`.
- Keeps existing Direct student email(s), selected cohort, and cohort Google Group modes.
- The new mode hides cohort/direct recipient fields and shows a safety note that preview resolves the exact deduped recipient count before sending.
- Existing daily limit, batch size, preview, confirmation, and duplicate-skip behavior remain shared with the current Email Centre flow.

## Backend Notes

- Supabase Edge Function `transactional-email` was deployed after this change.
- Active deployment confirmed:
  - Function: `transactional-email`
  - Version: `31`
  - Status: `ACTIVE`
- The backend now resolves `sendMode: all_active_students` from active rows in `students`, deduped by email, with the same batch and daily send controls.
- The all-active resolver supports up to 10,000 active LMS students; existing direct/cohort modes keep their previous resolver cap.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Final preview-only live resolver QA passed for `All active LMS students`:
  - 140 active LMS recipients resolved.
  - Resolved count matched the active valid-email count from the live `students` table.
  - 50 ready for current batch.
  - No email send action was performed.
- Preview-only regression passed for existing `Direct student email(s)` mode.
- Preview-only regression passed for existing `All students in selected cohort` mode using active cohort `FLP-AG-A-2026`.
- Send guard regression passed: unconfirmed send request was rejected with confirmation-required error.
