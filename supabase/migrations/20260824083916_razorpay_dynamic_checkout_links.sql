alter table public.payment_orders
  add column if not exists checkout_url text,
  add column if not exists razorpay_payment_link_id text;

alter table public.payment_orders
  drop constraint if exists payment_orders_checkout_url_check;

alter table public.payment_orders
  add constraint payment_orders_checkout_url_check
  check (checkout_url is null or checkout_url ~* '^https?://');

create index if not exists payment_orders_checkout_link_lookup_idx
  on public.payment_orders (razorpay_payment_link_id)
  where razorpay_payment_link_id is not null;

create index if not exists payment_orders_student_pending_item_idx
  on public.payment_orders (student_email, item_type, item_id, status, created_at desc);
