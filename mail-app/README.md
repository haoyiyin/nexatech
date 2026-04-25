# Nexatech Student Mailbox

Student email portal for Nexatech University. Built with the $0 Stack.

## Stack

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS 4 + shadcn/ui
- **Database & Auth**: Supabase (free tier: 500MB, 50K users)
- **Email Ingestion**: Cloudflare Email Routing + Email Worker (free tier: 100K req/day)
- **Deployment**: Vercel / Cloudflare Pages (free tier)

## Project Structure

```
mail-app/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx
│   ├── login/page.tsx            # Student login page
│   ├── inbox/page.tsx            # Inbox list (protected)
│   ├── inbox/[messageId]/page.tsx # Message detail (protected)
│   └── settings/password/page.tsx # Password change (protected)
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   ├── mail-layout.tsx           # Sidebar layout for authenticated pages
│   ├── inbox-list.tsx            # Inbox message list
│   └── message-view.tsx          # Message detail view
├── lib/
│   ├── supabase/client.ts        # Browser Supabase client
│   ├── supabase/server.ts        # Server Supabase client
│   ├── auth/require-session.ts   # Auth guard helper
│   ├── mail/sanitize-message.ts  # Email HTML sanitizer
│   └── utils.ts                  # cn() utility
├── scripts/
│   ├── create-student-account.ts # Admin: create single student
│   └── import-students-csv.ts    # Admin: bulk import from CSV
├── supabase/migrations/          # DB schema + reliability migrations
├── worker/
│   ├── email-ingest.ts           # Cloudflare Email Worker + scheduled replay/cleanup
│   └── wrangler.toml             # Worker configuration + cron triggers
├── middleware.ts                 # Next.js auth middleware
└── .env.example                  # Environment variable template
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project at https://supabase.com
2. Run the migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_mail_message_idempotency.sql`
   - `supabase/migrations/003_reliability_foundation.sql`
3. Disable public signups in Auth settings
4. Copy your project URL and anon key

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin scripts only)
- `MAIL_DOMAIN` - Your mail domain (default: nexatech.edu.kg)

### 4. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000/login

## Admin Operations

### Create a single student account

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run create-student -- student001 SecurePass1! S-2025-001
```

### Bulk import students from CSV

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run import-csv -- students.csv
```

CSV format:
```csv
email_prefix,password,student_id
student001,SecurePass1!,S-2025-001
student002,SecurePass2!,S-2025-002
```

### Migrate mailbox domain

Preview the change first:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MAIL_DOMAIN=nexatech.edu.kg \
  npm run migrate-mail-domain -- --dry-run
```

Run the migration:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MAIL_DOMAIN=nexatech.edu.kg \
  npm run migrate-mail-domain
```

## Cloudflare Email Worker

### Setup

1. Add MX records for `nexatech.edu.kg` to Cloudflare DNS.
2. Enable Email Routing in the Cloudflare dashboard.
3. Create an Email Worker route for the mailbox domain.
4. Authenticate Wrangler if needed: `wrangler login`.
5. From `mail-app/worker`, deploy the worker:

```bash
wrangler deploy --env production
```

6. Set production secrets from `mail-app/worker`:

```bash
wrangler secret put SUPABASE_SERVICE_KEY --env production
```

7. Set the public Supabase project URL in `worker/wrangler.toml` for both `[vars]` and `[env.production.vars]`.
8. Cron triggers are already defined in `worker/wrangler.toml`:
   - `7 * * * *` - replay transient ingestion failures
   - `17 3 * * *` - clean up retained data older than 30 days
9. Verify the worker can reach Supabase by sending a test email to an active mailbox account.

### Delivery behavior

- The worker rejects mail for non-matching domains, unknown recipients, and suspended mailboxes.
- Transient account lookup and storage failures are persisted in `mail_ingestion_failures` for scheduled replay.
- Replayed deliveries with the same recipient and resolved message identifier are classified as `duplicate` instead of inserting a second message.
- Messages without a `Message-ID` receive a deterministic synthetic identifier before storage so replayed deliveries still deduplicate.
- HTML-only messages are stored as plain text fallback so the inbox stays text-only.
- Daily retention cleanup removes `mail_messages`, `mail_ingestion_events`, `mail_ingestion_failures`, and `mail_job_runs` entries older than 30 days.

### Operations and observability

Use the Supabase SQL editor or psql to inspect recent delivery state.

Recent ingestion events:

```sql
select recipient_address, resolved_message_id, stage, status, error_category, error_message, created_at
from mail_ingestion_events
order by created_at desc
limit 50;
```

Pending or recent replay failures:

```sql
select recipient_address, resolved_message_id, stage, status, retry_count, next_retry_at, last_error, created_at
from mail_ingestion_failures
order by created_at desc
limit 50;
```

Recent replay / cleanup job runs:

```sql
select job_name, status, metadata_json, error_message, started_at, finished_at
from mail_job_runs
order by started_at desc
limit 20;
```

## Student Features (v1)

- Sign in with admin-provisioned credentials
- Read incoming messages
- Mark messages as read automatically
- Change password

## Security

- Row Level Security (RLS) ensures students can only access their own mailbox
- HTML email content is sanitized before display
- No outbound mail capability
- No self-registration
- No admin features exposed to students
