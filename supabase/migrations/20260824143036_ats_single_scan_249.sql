insert into public.ats_packages (package_key, title, description, scan_credits, amount, currency, sort_order, status)
values (
  'ats_single_scan',
  'ATS Advanced Scan',
  'One advanced ATS scan with detailed analysis, JD matching, line-level coaching, and branded report download.',
  1,
  249,
  'INR',
  10,
  'active'
)
on conflict (package_key) do update
set
  amount = excluded.amount,
  currency = excluded.currency,
  title = excluded.title,
  description = excluded.description,
  scan_credits = excluded.scan_credits,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();
