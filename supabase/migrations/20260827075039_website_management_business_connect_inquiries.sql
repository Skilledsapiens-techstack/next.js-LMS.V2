alter table public.website_campus_inquiries
  drop constraint if exists website_campus_inquiries_source_page_check;

alter table public.website_campus_inquiries
  add constraint website_campus_inquiries_source_page_check
  check (source_page in ('campus-connect', 'business-connect'));

create index if not exists website_campus_inquiries_source_created_idx
  on public.website_campus_inquiries (source_page, created_at desc);
