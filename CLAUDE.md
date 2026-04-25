# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This repo has two distinct parts:

1. Root-level static marketing site: `*.html`, `css/style.css`, `js/student-login.js`, `images/`
2. `mail-app/`: the actual student mailbox/admin portal built with Next.js 15 + Supabase + a Cloudflare Email Worker

There is no root package.json. Most application work happens in `mail-app/`.

## Common commands

Run these from `mail-app/` unless noted otherwise.

### Install

```bash
npm install
```

### Develop the Next app

```bash
npm run dev
```

The app uses `basePath: "/mail"`, so local routes are under `http://localhost:3000/mail/...`.

### Build and run production locally

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

### Unit/integration tests (Vitest)

Run the full test suite:

```bash
npm test
```

Run a single test file:

```bash
npm test -- app/api/auth/login/route.test.ts
```

Vitest config is in `mail-app/vitest.config.ts`. It runs in Node and excludes `tests/e2e/**`.

### E2E tests (Playwright)

Run all E2E tests:

```bash
npx playwright test
```

Run a single spec:

```bash
npx playwright test tests/e2e/health.spec.ts
```

Playwright is configured in `mail-app/playwright.config.ts` and targets `https://www.nexatech.edu.kg`, not localhost. Do not run E2E casually against production.

### Admin / data scripts

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

There is also an unwrapped k6 script at `load-tests/web/direct-api.js` with no `package.json` alias.

### Cloudflare Email Worker

Run from `mail-app/worker/`:

```bash
wrangler deploy --env production
wrangler secret put SUPABASE_SERVICE_KEY --env production
```

## Environment

`mail-app/.env.example` documents the required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAIL_DOMAIN`
- `SUPABASE_URL`

`lib/supabase/admin.ts` uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for server-only admin access.

## High-level architecture

### 1. Static site and mailbox app are intentionally linked

The static site in the repo root is the public university website. Student sign-in starts there via `js/student-login.js`, which opens a modal and posts to the mailbox API at `https://www.nexatech.edu.kg/mail/api/auth/login`.

The Next app also contains duplicated public-site assets in `mail-app/public/` (`public/*.html`, `public/css/style.css`, `public/js/student-login.js`, `public/images/*`). These are not just backups: the root copies serve the standalone static site, while `mail-app/public/` is what the Next app can serve. If you change shared marketing pages or the student-login bridge, decide deliberately whether both copies need the same change.

A particularly important detail: `student-login.js` hardcodes the production mailbox URL. Root static pages will not automatically talk to a local Next dev server.

### 2. Next app structure

`mail-app/app/` uses the App Router with route groups:

- `app/(mail)/...`: student mailbox UI
- `app/(admin)/...`: admin UI
- `app/api/auth/...`: student auth/password endpoints
- `app/api/admin/...`: admin auth and mailbox-management endpoints
- `app/api/health/route.ts`: health endpoint

Layouts are split by audience:

- `app/(mail)/layout.tsx` wraps authenticated student pages with `components/mail-layout.tsx`
- `app/(admin)/layout.tsx` is a pass-through route-group layout
- `app/(admin)/admin/layout.tsx` wraps authenticated admin pages with `components/admin-layout.tsx`

`app/page.tsx` is just a redirector into the basePath-aware login/inbox flow.

### 3. Auth model

Supabase Auth is the session system for both students and admins.

Key files:

- `mail-app/middleware.ts`: canonical host redirect, session lookup, route protection, and redirects between website login, student routes, and admin routes
- `mail-app/lib/auth/require-session.ts`: student-only server guard
- `mail-app/lib/auth/require-admin-session.ts`: admin-only server guard that additionally checks `mailbox_accounts.role` and `status`

Student login and admin login each have separate route handlers:

- `app/api/auth/login/route.ts`
- `app/api/admin/auth/login/route.ts`

Both validate input with Zod, check origin, apply rate limiting, create Supabase sessions, and then verify the mailbox account record before allowing access.

### 4. Supabase is the system of record

The main app is thin UI over Supabase tables and auth.

From the code and migrations, the key data domains are:

- `mailbox_accounts`: user-to-mailbox mapping, role, and active/suspended status
- `mail_messages`: inbox message storage
- `login_rate_limits`: backing store for auth throttling
- `mail_ingestion_events`: audit/observability for email delivery
- `mail_ingestion_failures`: retry queue for transient worker failures
- `mail_job_runs`: scheduled-job observability

Server/client split:

- `lib/supabase/server.ts`: request-bound server client using cookies
- `lib/supabase/client.ts`: browser client
- `lib/supabase/admin.ts`: service-role client that bypasses RLS; never use this in client code

### 5. Student mailbox flow

Student pages are simple server-rendered reads from Supabase:

- `app/(mail)/inbox/page.tsx`: fetches mailbox identity plus paginated message summaries
- `app/(mail)/inbox/[messageId]/page.tsx`: fetches a single message scoped to `owner_user_id`
- `app/(mail)/settings/password/page.tsx`: client form that posts to `app/api/auth/change-password/route.ts`

HTML email is never rendered as live markup. `lib/mail/sanitize-message.ts` converts HTML input into plain text for safe display.

### 6. Admin flow

Admin features are split into small server-side service modules under `lib/admin/` and route handlers/pages that call them.

Main areas:

- `lib/admin/dashboard/get-admin-dashboard-metrics.ts`: dashboard counters and latest cleanup status
- `lib/admin/accounts/*.ts`: create, list, suspend/reactivate, reset password, delete mailbox accounts
- `lib/admin/retention/run-retention-cleanup.ts`: manual cleanup logic for retained messages/events/failures/job runs

Representative entry points:

- `app/(admin)/admin/page.tsx`: dashboard
- `app/(admin)/admin/mailboxes/page.tsx`: searchable/paginated mailbox list
- `app/(admin)/admin/mailboxes/new/page.tsx`: create-mailbox UI
- `app/api/admin/mailboxes/route.ts`: list/create mailbox API
- `app/api/admin/retention/cleanup/route.ts`: manual retention cleanup API

### 7. Rate limiting and request helpers

Auth and health checks share helper utilities:

- `lib/auth/login-rate-limit.ts`: rate-limit math and thresholds
- `lib/auth/login-rate-limit-store.ts`: persistence via Supabase table/RPC
- `lib/auth/api-helpers.ts`: JSON responses, origin validation, and client IP extraction

The route handlers generally treat rate-limit-store failures as non-fatal by wrapping those checks in `try/catch`, so auth and health checks can continue if the backing store is temporarily unavailable.

### 8. Email ingestion worker

Inbound mail does not arrive through Next.js. It is handled by the Cloudflare worker in `mail-app/worker/`.

Important files:

- `worker/email-ingest.ts`: accepts inbound mail, validates domain/recipient, parses MIME, stores messages, records events, queues retries for transient failures, replays failures on cron, and performs retention cleanup
- `worker/email-parse.ts`: MIME parsing
- `worker/wrangler.toml`: worker config and cron schedule

The worker writes directly to Supabase REST endpoints using the service key. Reliability is a first-class concern: deduplication, retry scheduling, replay, and cleanup are all built into the worker layer.

### 9. Testing layout

Tests are distributed by concern:

- colocated `*.test.ts` / `*.test.tsx` beside route handlers, services, and components
- Playwright specs under `mail-app/tests/e2e/`
- worker tests in `mail-app/worker/email-ingest.test.ts`
- script tests in `mail-app/scripts/*.test.ts`

## Non-obvious repo notes

- `backup/` is archival/reference material, not the active app.
- `mail-app/vercel.json` and `.vercel/` indicate the Next app is configured for Vercel deployment; the email ingestion path is separate in `mail-app/worker/`.
- `mail-app/PRD-school-mail-portal.md` and the bilingual READMEs (`README.md`, `README.zh-CN.md`) contain additional setup/product context when behavior or scope is unclear.
- `mail-app/worker/.wrangler/` is generated worker state/artifacts, not source.
- The README's route examples may lag the code; trust `next.config.ts` and `middleware.ts` for current routing behavior.
- Because the app is mounted at `/mail`, API fetches and redirects should usually be basePath-aware.