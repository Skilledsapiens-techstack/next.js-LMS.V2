-- Guest Leads admin notes.
-- Internal notes are admin-only and do not affect guest/student portal access.

create table if not exists public.guest_lead_notes (
  id uuid primary key default gen_random_uuid(),
  guest_lead_id uuid not null references public.guest_leads(id) on delete cascade,
  note text not null,
  created_by text,
  created_at timestamptz not null default now(),
  constraint guest_lead_notes_note_not_blank check (length(btrim(note)) > 0)
);

create index if not exists guest_lead_notes_guest_lead_idx
  on public.guest_lead_notes (guest_lead_id, created_at desc);

alter table public.guest_lead_notes enable row level security;

grant select, insert on table public.guest_lead_notes to authenticated;

drop policy if exists "guest lead notes readable by student admins" on public.guest_lead_notes;
create policy "guest lead notes readable by student admins"
on public.guest_lead_notes
for select
to authenticated
using ((select public.admin_has_permission('admin.students.view')));

drop policy if exists "guest lead notes manageable by student admins" on public.guest_lead_notes;
create policy "guest lead notes manageable by student admins"
on public.guest_lead_notes
for insert
to authenticated
with check ((select public.admin_has_permission('admin.students.manage')));
