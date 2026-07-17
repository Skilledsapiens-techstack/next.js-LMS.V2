# Skilled Sapiens LMS - Recording Sequence Manager

Package: `lms-hostinger-staging-20260714-recording-sequence-manager`
Date: 14 Jul 2026

## Included

- Admin Recording Sequence Manager inside Admin > Recordings.
- Program-wise sequence rules with title and aliases.
- Published recording badges: `Seq N` or `Unsequenced`.
- Student Watch Recordings layout:
  - Shows current view as-is when no sequence is matched.
  - Shows Learning Path + Additional Recordings when sequence matches exist.
  - Groups by program when a student has recordings from multiple programs.

## Backend

Applied Supabase migration:

- `20260714102816_recording_sequence_rules.sql`

Remote table check returned `sequence_rule_count = 0`, matching the no-seed requirement.

## QA

- `npm run build` passed after implementation.
- Supabase remote migration push completed successfully.
- Add Link, Pending Review, and Rejected recording tabs are not sequence-sorted.
- Sequence logic only affects Published admin ordering and Student Watch Recordings display.
