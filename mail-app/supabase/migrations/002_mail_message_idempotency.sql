-- Migration: 002_mail_message_idempotency
-- Prevent duplicate inbound deliveries from creating duplicate mail_messages rows

create unique index if not exists idx_mail_messages_to_message_id
  on mail_messages (to_address, message_id_header);
