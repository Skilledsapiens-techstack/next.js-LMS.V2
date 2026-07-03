drop trigger if exists support_ticket_admin_notification on public.support_tickets;
drop trigger if exists support_ticket_message_admin_notification on public.support_ticket_messages;
drop function if exists public.queue_support_admin_notification();
