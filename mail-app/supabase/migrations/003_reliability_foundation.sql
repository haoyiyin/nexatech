-- Migration: 003_reliability_foundation
-- Adds inbound reliability, replay, and scheduled job tracking tables

create table if not exists mail_ingestion_events (
  id uuid primary key default gen_random_uuid(),
  recipient_address text,
  sender_address text,
  resolved_message_id text,
  stage text not null,
  status text not null,
  error_category text,
  error_message text,
  metadata_json jsonb,
  created_at timestamptz not null default now(),
  check (stage in (
    'config_validation',
    'domain_validation',
    'parse_email',
    'account_lookup',
    'store_message',
    'replay_failures',
    'cleanup_retention'
  )),
  check (status in (
    'stored',
    'duplicate',
    'rejected',
    'failed_transient',
    'failed_permanent',
    'replayed',
    'cleanup_success',
    'cleanup_failed'
  )),
  check (error_category is null or error_category in ('transient', 'permanent'))
);

alter table mail_ingestion_events enable row level security;

create policy mail_ingestion_events_service_role_all
  on mail_ingestion_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists idx_mail_ingestion_events_status_created_at
  on mail_ingestion_events (status, created_at desc);

create index if not exists idx_mail_ingestion_events_message_created_at
  on mail_ingestion_events (resolved_message_id, created_at desc);

create table if not exists mail_ingestion_failures (
  id uuid primary key default gen_random_uuid(),
  recipient_address text not null,
  sender_address text not null,
  resolved_message_id text not null,
  stage text not null,
  status text not null default 'pending',
  raw_email text not null check (octet_length(raw_email) <= 10485760),
  retry_count integer not null default 0 check (retry_count >= 0),
  next_retry_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('pending', 'replayed', 'duplicate', 'failed_permanent', 'abandoned')),
  check (stage in ('account_lookup', 'store_message'))
);

alter table mail_ingestion_failures enable row level security;

create policy mail_ingestion_failures_service_role_all
  on mail_ingestion_failures for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create unique index if not exists idx_mail_ingestion_failures_message
  on mail_ingestion_failures (recipient_address, resolved_message_id);

create index if not exists idx_mail_ingestion_failures_status_next_retry_at
  on mail_ingestion_failures (status, next_retry_at);

create index if not exists idx_mail_ingestion_failures_created_at
  on mail_ingestion_failures (created_at desc);

create table if not exists mail_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  metadata_json jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  check (job_name in ('replay_failures', 'cleanup_retention')),
  check (status in ('running', 'success', 'failed'))
);

alter table mail_job_runs enable row level security;

create policy mail_job_runs_service_role_all
  on mail_job_runs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists idx_mail_job_runs_job_started_at
  on mail_job_runs (job_name, started_at desc);
