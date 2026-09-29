# SapiensPulse Boundary

SapiensPulse is the student-first campus community and opportunity product surface.

Keep new Pulse product code inside this folder unless a change is intentionally shared with LMS.

## Folder Map

- `components/`: Reusable Pulse UI and product components.
- `features/`: Feature-specific data hooks, services, and state.
- `layouts/`: Pulse public, app, auth, and moderation layouts.
- `pages/`: Pulse route-level pages.
- `styles/`: Pulse design tokens and product-specific styles.
- `lib/`: Pulse utilities, guards, analytics, and adapters.

## Boundary Rules

- Pulse must not use the LMS portal shell as its primary experience.
- Shared auth, routing, API clients, and Supabase types may live outside this folder when they intentionally support both products.
- Existing LMS pages should stay in the current `src/pages`, `src/features`, and `src/layouts` structure until a separate LMS migration is planned.
- Any change outside `src/pulse` during Pulse work should explain whether it affects LMS, shared platform behavior, or deployment.
