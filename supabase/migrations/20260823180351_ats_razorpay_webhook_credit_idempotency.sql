-- Make Razorpay -> ATS credit activation idempotent.
-- Razorpay webhooks can be retried, so payment-based credits must be unique
-- by both LMS payment order and Razorpay payment id when those references exist.

create unique index if not exists ats_student_credit_grants_payment_order_unique_idx
  on public.ats_student_credit_grants (source_payment_order_id)
  where source = 'payment'
    and source_payment_order_id is not null;

create unique index if not exists ats_student_credit_grants_payment_id_unique_idx
  on public.ats_student_credit_grants (source_payment_id)
  where source = 'payment'
    and source_payment_id is not null;

create index if not exists payment_orders_ats_order_lookup_idx
  on public.payment_orders (item_type, order_id)
  where item_type = 'ats_package';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_orders'
      and column_name = 'razorpay_order_id'
  ) then
    execute 'create index if not exists payment_orders_ats_razorpay_order_lookup_idx on public.payment_orders (item_type, razorpay_order_id) where item_type = ''ats_package'' and razorpay_order_id is not null';
  end if;
end $$;
