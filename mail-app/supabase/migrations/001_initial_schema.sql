-- Migration: 001_initial_schema
-- Creates the mailbox_accounts and mail_messages tables with RLS policies

-- ============================================================
-- Table: mailbox_accounts
-- Maps each Supabase auth user to a mailbox email address
-- ============================================================
create table if not exists mailbox_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email_address text not null unique,
  student_identifier text,
  role text not null default 'student' check (role in ('student', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table mailbox_accounts enable row level security;

-- Users can only view their own account
create policy mailbox_accounts_select_own
  on mailbox_accounts for select
  using (auth.uid() = user_id);

-- Service role (admin) can manage all accounts
create policy mailbox_accounts_admin_all
  on mailbox_accounts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- Table: mail_messages
-- Stores inbound email messages
-- ============================================================
create table if not exists mail_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_email_address text not null,
  message_id_header text,
  from_address text not null,
  to_address text not null,
  subject text,
  text_body text,
  html_body_sanitized text,
  received_at timestamptz not null default now(),
  is_read boolean not null default false,
  size_bytes integer,
  headers_json jsonb
);

alter table mail_messages enable row level security;

-- Users can only view their own messages
create policy mail_messages_select_own
  on mail_messages for select
  using (auth.uid() = owner_user_id);

-- Users can mark their own messages as read
create policy mail_messages_update_own
  on mail_messages for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- Service role (email worker) can insert messages
create policy mail_messages_service_insert
  on mail_messages for insert
  with check (auth.role() = 'service_role');

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_mail_messages_owner
  on mail_messages (owner_user_id, received_at desc);

create index if not exists idx_mail_messages_owner_email
  on mail_messages (owner_email_address, received_at desc);

create index if not exists idx_mail_accounts_user_id
  on mailbox_accounts (user_id);

create index if not exists idx_mail_accounts_email
  on mailbox_accounts (email_address);
