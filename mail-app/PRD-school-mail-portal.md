# PRD: School Mail Portal

## Status
Draft v1

## Document Purpose
This document defines the product requirements for the Nexatech School Mail Portal and should serve as the long-term source of truth for ongoing development.

The portal is intentionally **not** a full email product. It is a **school-managed inbound mail portal** for students:
- students can sign in
- students can view inbound messages
- students cannot send mail
- the system only needs to support **text email rendering** for now
- the system must be reliable enough for long-term school use

---

## 1. Product Summary

### 1.1 Product Name
Nexatech School Mail Portal

### 1.2 Product Vision
Provide every student with a school email inbox that is:
- simple
- stable
- low-maintenance
- secure
- affordable to operate

The portal should feel like a lightweight school mailbox, not a general-purpose email platform.

### 1.3 Product Positioning
This product is a **read-focused inbound mail portal**.

It is designed for:
- school notices
- account-related emails
- admissions and academic communication
- automated inbound messages sent to student mailboxes

It is not designed for:
- composing or sending emails
- advanced mailbox workflows
- rich HTML email rendering
- multi-folder email clients
- enterprise collaboration features

---

## 2. Problem Statement

The project needs a practical school email solution, but:
- fully managed education email products may not be available for free to the institution
- full mail-server self-hosting is operationally heavy
- a fully static email system is not technically possible
- the current custom solution is close to usable, but still lacks the reliability and admin tooling needed for long-term school use

The product should therefore evolve into a **lightweight, reliable, inbound-only mail portal** built around:
- Cloudflare Email Routing
- a worker-based inbound processing layer
- a web portal for students
- an admin console for mailbox management
- controlled retention and cleanup

---

## 3. Goals

### 3.1 Primary Goals
1. Support reliable inbound mail delivery for student mailboxes.
2. Allow students to sign in and read their messages from a web portal.
3. Support only text email content in the first production version.
4. Remain stable under normal school concurrency and daily usage.
5. Provide an admin console to create and manage student mailbox accounts.
6. Automatically delete messages older than 30 days.
7. Keep the product simple enough to operate long term.

### 3.2 Success Criteria
The product is successful when:
- students can reliably receive and read school emails
- mailbox isolation is correct for every student
- admins can create and manage accounts without scripts
- the system remains responsive under multi-user load
- old mail is cleaned up automatically
- operational burden stays low enough for a small school IT team

---

## 4. Non-Goals

The following are explicitly out of scope for the current product direction:
- outbound email sending by students
- SMTP submission for end users
- full HTML email rendering fidelity
- attachment support in v1
- folders, labels, archive, star, drafts, trash, spam folders
- message reply, forward, compose
- IMAP/POP client access in v1
- full enterprise email server behavior
- indefinite mail retention
- multi-tenant platform support beyond the school use case

---

## 5. Target Users

### 5.1 Student
A student signs in with their school mailbox credentials and reads inbound messages.

### 5.2 School Administrator
A school admin creates and manages student mailboxes, resets passwords, suspends accounts, and monitors mailbox operations.

### 5.3 Technical Operator
A technical maintainer monitors service health, delivery failures, retention jobs, and infrastructure issues.

---

## 6. Core Product Scope

### 6.1 Student Portal Scope
Students must be able to:
- sign in securely
- open their inbox
- view a paginated list of messages
- open message details
- read text-only message content
- mark messages as read automatically when opened
- change their password
- sign out

Students must not be able to:
- send email
- reply or forward
- upload attachments
- access other students' messages

### 6.2 Admin Portal Scope
Admins must be able to:
- sign in to an admin interface
- create single student mailbox accounts
- bulk import mailbox accounts from CSV
- reset student passwords
- suspend and reactivate mailbox accounts
- view basic mailbox account metadata
- search mailbox accounts
- view message counts or recent activity summaries

Admins should also be able to:
- trigger reprocessing or inspect recent failed inbound events
- view retention / cleanup status

### 6.3 Inbound Mail Processing Scope
The system must:
- accept inbound email routed from Cloudflare Email Routing
- validate recipient mailboxes
- parse email safely
- store a text representation of the message
- associate each message with the correct student account
- avoid duplicate message insertion where practical
- fail safely and support retry/recovery paths

---

## 7. Product Principles

1. **Reliability over richness**
   Stable text-only email is more important than rich email rendering.

2. **Simple over complete**
   This is a school inbox portal, not a full mail suite.

3. **Operationally lightweight**
   The system should stay manageable by a small team.

4. **Data minimization**
   Keep only what is needed and automatically delete mail older than 30 days.

5. **Security by default**
   Strong isolation, admin boundaries, and defensive auth patterns are required.

---

## 8. Functional Requirements

## 8.1 Authentication and Access Control

### Requirements
- Students must authenticate with mailbox credentials.
- Admins must authenticate with elevated access separate from students.
- Protected routes must require valid sessions.
- Students must only access their own mailbox account and messages.
- Admin actions must require admin role checks.
- Password change must verify the current password.
- Auth endpoints must include rate limiting and origin protection.

### Acceptance Criteria
- A student cannot access another student's inbox or message by URL manipulation.
- A non-admin cannot access admin pages or admin APIs.
- Login and password-change endpoints are rate-limited.

---

## 8.2 Inbox Experience

### Requirements
- Inbox must show recent inbound messages for the signed-in student.
- Inbox list must display at minimum:
  - sender
  - subject
  - received time
  - read/unread state
- Inbox must support pagination.
- Opening a message should not block initial render on non-essential writes.
- Empty-state UX must be supported.

### Acceptance Criteria
- A mailbox with many messages still loads within an acceptable time due to pagination.
- Opening a message updates read state asynchronously.
- Inbox remains usable under concurrent student access.

---

## 8.3 Message Detail Experience

### Requirements
- Message detail must display:
  - from
  - to
  - date/time
  - subject
  - text body
- Text-only rendering is sufficient for v1.
- If raw email contains HTML only, the system may convert it to readable plain text.
- If content cannot be rendered, a safe fallback message should be shown.

### Acceptance Criteria
- Text emails render correctly.
- HTML-only emails degrade into readable text where possible.
- No unsafe raw HTML is rendered directly in v1.

---

## 8.4 Admin Mailbox Management

### Requirements
- Admins can create individual student mailboxes.
- Admins can bulk-create mailboxes via CSV import.
- Admins can suspend and reactivate accounts.
- Admins can reset passwords.
- Admins can search for accounts by email or student identifier.
- Admins can see whether an account is active or suspended.

### Acceptance Criteria
- A school admin can provision a new mailbox without using CLI scripts.
- Bulk import works for a standard CSV file.
- Suspended accounts cannot sign in.

---

## 8.5 Retention and Cleanup

### Requirements
- Messages older than 30 days must be deleted automatically.
- Cleanup must run on a reliable schedule.
- Cleanup should be idempotent.
- Cleanup failure must be observable.
- The UI should not depend on old mail beyond the retention window.

### Acceptance Criteria
- Messages older than 30 days are removed automatically without manual action.
- Cleanup runs at least daily.
- Failed cleanup runs can be detected through logs or monitoring.

---

## 8.6 Inbound Processing Reliability

### Requirements
- Inbound delivery should not depend on a single fragile synchronous write path.
- The system must support retry or recovery when downstream storage is temporarily unavailable.
- Failures should be observable.
- Duplicate message handling should be addressed with an idempotency strategy where possible.
- Recipient validation must be enforced before mail is accepted into the student mailbox system.

### Acceptance Criteria
- Temporary downstream issues do not silently lose mail without visibility.
- Failed processing attempts can be retried or audited.
- Duplicate inserts are minimized or prevented.

---

## 9. Reliability Requirements

This project is intended for long-term school use, so reliability requirements are first-class product requirements.

### 9.1 Concurrency and Performance
The system must remain usable when multiple students concurrently:
- log in
- refresh inboxes
- open message details
- change passwords

### Requirements
- Inbox queries must be paginated.
- Student-facing pages must avoid unnecessary full reloads.
- Core message queries must be index-friendly.
- Message open should not block on non-essential writes.
- Critical auth and inbox APIs must remain responsive under typical school load.

### 9.2 Delivery Stability
The system should not rely on a single best-effort synchronous insert for inbound delivery.

### Requirements
- Inbound processing must include at least one of:
  - durable buffering
  - retry queue
  - replayable failure storage
- Delivery failures must be logged in a way operators can inspect.
- The school must be able to identify whether a specific inbound message failed before mailbox insertion.

### 9.3 Recovery
### Requirements
- Operators must be able to recover from transient processing failure.
- The system should support replaying failed inbound events or at minimum provide enough data to diagnose failure.
- Database growth must remain bounded because of the 30-day retention policy.

---

## 10. Security Requirements

### Requirements
- Student isolation must be enforced by both app logic and database access rules.
- Admin-only actions must be server-side protected.
- Auth endpoints must be rate-limited.
- Origin checks must remain in place for auth APIs.
- Passwords must never be stored in plaintext.
- Service-role credentials must remain server-only.
- Mail content must not be exposed across users.
- Public access to internal admin functions must be blocked.

### Nice-to-have future improvements
- stronger event logging for auth and admin actions
- explicit audit trail for mailbox management
- better delivery observability dashboards

---

## 11. Data Model Expectations

The current schema direction is acceptable if extended carefully.

### Core entities expected
- mailbox_accounts
- mail_messages
- admin users / admin role mapping
- optional mail ingestion event log / processing status log
- optional failed processing queue or replay record

### Message storage requirements
For v1, a stored message should support at minimum:
- owner_user_id
- owner_email_address
- from_address
- to_address
- subject
- text_body
- received_at
- read state
- optional message_id_header for deduplication
- minimal headers if useful for audit/debug

### Retention rule
- message rows older than 30 days must be deleted automatically

---

## 12. Admin Console Requirements

### 12.1 Pages / Views
The admin console should include:
- dashboard
- mailbox accounts list
- create mailbox form
- bulk import page
- account detail view
- password reset action
- suspend/reactivate action
- recent processing failures / mail health summary

### 12.2 MVP Admin Dashboard Metrics
At minimum the dashboard should show:
- total active mailboxes
- total suspended mailboxes
- messages received in last 24h
- failed inbound processing count in last 24h
- last cleanup job status

---

## 13. Operational Requirements

### Requirements
- scheduled cleanup for 30-day retention
- logs for inbound processing failures
- logs for cleanup failures
- logs for admin mailbox actions
- repeatable deployment process
- basic backup strategy for account and message data within the retention window

### Strong recommendation
Even for a lightweight product, operations should include:
- uptime monitoring
- alerting for repeated worker failures
- alerting for database/storage growth anomalies

---

## 14. Roadmap

## Phase 1: Stabilize Current Portal
Goal: make the existing student portal safe for pilot usage.

### Deliverables
- complete auth hardening
- paginated inbox
- stable login/password flows
- text-only message rendering finalized
- deployable Cloudflare inbound path
- end-to-end receipt verification

## Phase 2: Reliability Foundation
Goal: make inbound processing school-safe.

### Deliverables
- retry/recovery path for inbound processing
- failure logging and visibility
- deduplication strategy
- cleanup job for >30 day messages
- delivery observability basics

## Phase 3: Admin Console MVP
Goal: remove CLI dependence for school operations.

### Deliverables
- admin auth and role checks
- create mailbox UI
- suspend/reactivate UI
- password reset UI
- bulk CSV import UI
- admin dashboard summary

## Phase 4: Production Hardening
Goal: support long-term school operations.

### Deliverables
- monitoring and alerting
- audit trail for admin actions
- improved delivery failure workflows
- operational runbooks
- capacity review under real traffic

---

## 15. MVP Definition

The MVP is complete when all of the following are true:
- a student can sign in and read inbound text emails
- inbox is paginated
- messages are isolated correctly
- admins can create and manage mailbox accounts from a UI
- inbound processing failures are visible
- messages older than 30 days are deleted automatically
- the portal can be piloted with real student users

---

## 16. Acceptance Criteria for School Pilot

A school pilot is acceptable when:
1. At least one admin can create accounts without using scripts.
2. A student can receive, see, and open a text email end-to-end.
3. Multiple students can use the portal concurrently without major degradation.
4. Failed inbound events are visible to operators.
5. Cleanup removes old mail automatically.
6. Password changes work reliably.
7. Suspended students cannot log in.

---

## 17. Future Considerations (Not Current Scope)

Potential future extensions after the core portal is stable:
- attachment support
- HTML email rendering improvements
- search
- mailbox quotas
- admin resend/replay tools
- read/unread bulk actions
- audit exports
- deeper monitoring dashboards
- integration with school identity systems

These are intentionally deferred until the inbound-only, text-first portal is stable.

---

## 18. Product Decision Summary

### Current strategic decision
The project will continue as a **lightweight inbound-only school mail portal**, not a full mail platform.

### Product boundaries
- inbound only
- text first
- no student sending
- 30-day retention
- admin-managed accounts
- reliability and operational stability prioritized over rich features

This PRD should guide future implementation decisions. If a future request conflicts with these principles, this document should be updated explicitly before the product scope changes.
