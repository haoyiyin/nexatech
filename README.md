# Nexatech Mail Platform

> **⚠️ Disclaimer:** This project is for educational and demonstration purposes only.

[中文说明 / 中文 README](./README.zh-CN.md)

Nexatech Mail Platform is a school-oriented mailbox system that combines:

- a public university website served as static pages from the repository root
- a Next.js 15 mailbox and admin portal under `mail-app/`
- Supabase for authentication and data storage
- a Cloudflare Email Worker for inbound mail ingestion

Students sign in from the public website via a login modal and are redirected into the `/mail` application to read messages and change passwords. Administrators can provision and manage mailbox accounts from the admin area.

## Demo

Live demo: [https://www.nexatech.edu.kg/](https://www.nexatech.edu.kg/)

## Repository layout

This repository has two main parts:

1. **Root static website**
   - `index.html`, `programs.html`, `admissions.html`, `campus.html`, `faculty.html`, `news.html`, `contact.html`
   - `css/style.css`
   - `js/student-login.js`
   - `images/`

2. **`mail-app/` Next.js application**
   - student inbox and password management
   - admin login, dashboard, mailbox management, and retention cleanup
   - Supabase-backed authentication and mailbox storage
   - Cloudflare Email Worker and operational scripts

## Core features

### Student features
- Sign in with administrator-provisioned credentials
- View inbox messages
- Open message details
- Change password

### Admin features
- Admin login flow
- Dashboard metrics for mailbox health and recent activity
- Create mailbox accounts
- List/search mailboxes
- Suspend/reactivate mailboxes
- Reset mailbox passwords
- Delete mailbox accounts
- Run manual retention cleanup

### Email ingestion features
- Cloudflare Email Routing → Worker → Supabase pipeline
- Duplicate protection for replayed emails
- Retry queue for transient delivery failures
- Retention cleanup cron jobs
- Plain-text storage/display strategy for HTML-only emails

## Tech stack

- **Frontend / App**: Next.js 15, React 19, Tailwind CSS 4
- **Auth + Database**: Supabase
- **Inbound email**: Cloudflare Email Routing + Cloudflare Worker
- **Testing**: Vitest, Playwright, k6
- **Deployment**: Vercel for the web app, Cloudflare for email/DNS/worker

## Local development

Most app development happens inside `mail-app/`.

### Prerequisites

- Node.js 18+
- npm
- A Supabase project
- A Cloudflare account if you want to test the worker deployment

### Install dependencies

```bash
cd mail-app
npm install
```

### Configure environment

Create a local env file from the example:

```bash
cp .env.example .env.local
```

Required variables in `mail-app/.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAIL_DOMAIN`
- `SUPABASE_URL`

### Start the app locally

```bash
npm run dev
```

Because the app uses `basePath: "/mail"`, the mailbox routes are served under:

- `http://localhost:3000/mail/login`
- `http://localhost:3000/mail/inbox`
- `http://localhost:3000/mail/admin/login`

## Useful commands

Run these from `mail-app/`.

### Build

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

### Unit and integration tests

```bash
npm test
```

Run one test file:

```bash
npm test -- app/api/auth/login/route.test.ts
```

### E2E tests

```bash
npx playwright test
```

Run one spec:

```bash
npx playwright test ./tests/e2e/health.spec.ts
```

Note: Playwright is configured to target `https://www.nexatech.edu.kg`, not localhost, so review before running production-facing E2E tests.

### Admin and migration scripts

```bash
npm run create-student -- <emailPrefix> <password> <studentId>
npm run import-csv -- <csvFile>
npm run migrate-mail-domain -- --dry-run
npm run migrate-mail-domain
npm run export-load-test-fixtures
npm run send-load-test-mails
```

### Load tests

```bash
npm run load:web:health
npm run load:web:login
npm run load:web:inbox
npm run load:web:message-detail
npm run load:web:admin-dashboard
npm run load:web:prod-mixed
```

## Deployment overview

A production deployment has three major pieces:

1. **Supabase project** for auth + mailbox data
2. **Vercel deployment** for the website/app
3. **Cloudflare Email Routing + Worker** for inbound mail delivery

---

## Step 1: Create and configure Supabase

1. Create a new Supabase project.
2. Run the SQL migrations in `mail-app/supabase/migrations/`.
   Recommended order:
   - `001_initial_schema.sql`
   - `002_login_rate_limits.sql`
   - `002_mail_message_idempotency.sql`
   - `003_reliability_foundation.sql`
3. In Supabase Auth settings, disable public self-signup if you want the mailbox system to stay admin-provisioned only.
4. Collect these values from Supabase:
   - Project URL
   - anon key
   - service role key

These values are used by the Next app and operational scripts.

---

## Step 2: Deploy the Next.js application to Vercel

The `mail-app/vercel.json` file rewrites top-level website routes to the static assets served under `/mail/...`, allowing the public site and mailbox app to live together in one deployment.

### Deploy

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Set the project root to `mail-app/` if required by your Vercel setup.
4. Add the required environment variables in Vercel:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin access |
| `SUPABASE_URL` | Supabase project URL for server/admin code |
| `MAIL_DOMAIN` | Mail domain, e.g. `nexatech.edu.kg` |

5. Add your production domain, for example `www.nexatech.edu.kg`.
6. Deploy.

### Notes

- The app uses `basePath: "/mail"` in `mail-app/next.config.ts`.
- `mail-app/middleware.ts` enforces the canonical host and protects mailbox/admin routes.
- The public website files are also duplicated in `mail-app/public/` so the Vercel deployment can serve them through rewrites.

---

## Step 3: Configure DNS and Email Routing in Cloudflare

1. Move the mail domain DNS to Cloudflare if it is not already there.
2. Add the required MX records for Cloudflare Email Routing.
3. Enable **Email Routing** in the Cloudflare dashboard.
4. Route inbound addresses for your school domain to the Worker you will deploy in the next step.

If you want a catch-all mailbox pipeline, configure your Email Routing rules accordingly.

---

## Step 4: Deploy the Cloudflare Email Worker

The worker lives in `mail-app/worker/` and is responsible for:

- parsing inbound email
- validating recipient/domain
- storing mail in Supabase
- recording delivery events/failures
- replaying transient failures on cron
- running retention cleanup

### Deploy the worker

```bash
cd mail-app/worker
wrangler login
wrangler deploy --env production
```

### Configure secrets

Set the service role key in Cloudflare:

```bash
wrangler secret put SUPABASE_SERVICE_KEY --env production
```

### Configure public worker vars

Edit `mail-app/worker/wrangler.toml` and set:

- `MAIL_DOMAIN`
- `SUPABASE_URL`

The cron triggers are already defined:

- `7 * * * *` — replay transient ingestion failures
- `17 3 * * *` — clean up retained data older than 30 days

---

## Step 5: Create mailbox accounts

After Supabase and the app are live, create student mailboxes from `mail-app/`.

### Create one student mailbox

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run create-student -- student001 SecurePass1! S-2025-001
```

### Bulk import from CSV

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

### Preview and run mail-domain migration

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MAIL_DOMAIN=nexatech.edu.kg \
  npm run migrate-mail-domain -- --dry-run
```

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MAIL_DOMAIN=nexatech.edu.kg \
  npm run migrate-mail-domain
```

---

## Step 6: Validate the deployment

### Web and login
- Open the public website.
- Click **Student Login**.
- Confirm the login modal appears.
- Sign in with a provisioned student account.
- Confirm redirect into `/mail/inbox`.

### Mail delivery
- Send a test email from an external mailbox to an active student mailbox.
- Confirm it appears in the student inbox.

### Admin
- Sign in at `/mail/admin/login`.
- Confirm the dashboard loads.
- Verify mailbox management and retention cleanup actions.

### Health endpoint
- Check `/mail/api/health`
- Confirm Supabase connectivity is healthy.

---

## Security model

- Students cannot self-register.
- Row Level Security (RLS) isolates mailbox data.
- Server-side admin actions use the service role key only on the backend.
- HTML email is converted to plain text for safe display.
- Student and admin login endpoints include origin checks and rate limiting.
- No outbound mail feature is included.

## Additional project docs

There is more detail in:

- [`mail-app/README.md`](./mail-app/README.md)
- [`mail-app/README.zh-CN.md`](./mail-app/README.zh-CN.md)
- [`CLAUDE.md`](./CLAUDE.md)

## License

This repository is licensed under the [MIT License](./LICENSE).
