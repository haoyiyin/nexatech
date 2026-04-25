/**
 * Cloudflare Email Worker for nexatech email ingestion.
 *
 * Receives inbound email via Cloudflare Email Routing,
 * parses the MIME message, verifies recipient exists,
 * persists to Supabase, and records reliability events.
 *
 * Deploy via: wrangler deploy --env production
 */

import { htmlToPlainText } from "../lib/mail/sanitize-message";
import { parseEmail, type EmailData } from "./email-parse";

const MAIL_MESSAGE_CONFLICT_COLUMNS = "to_address,message_id_header";
const MAIL_MESSAGE_INSERT_PREFER = "resolution=ignore-duplicates,return=representation";
const INGESTION_FAILURE_CONFLICT_COLUMNS = "recipient_address,resolved_message_id";
const INGESTION_FAILURE_INSERT_PREFER = "resolution=ignore-duplicates,return=minimal";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RAW_EMAIL_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_REPLAY_ATTEMPTS = 5;
const REPLAY_BATCH_SIZE = 100;
const MAX_REPLAY_BATCHES_PER_RUN = 1;
const RETENTION_DELETE_BATCH_SIZE = 100;
const MAX_RETENTION_DELETE_BATCHES_PER_TABLE = 1;
const RETRY_BASE_DELAY_MS = 5 * 60 * 1000;
const RETENTION_WINDOW_DAYS = 30;

export const REPLAY_FAILURES_CRON = "7 * * * *";
export const CLEANUP_RETENTION_CRON = "17 3 * * *";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  MAIL_DOMAIN: string;
}

type EventStage =
  | "config_validation"
  | "domain_validation"
  | "parse_email"
  | "account_lookup"
  | "store_message"
  | "replay_failures"
  | "cleanup_retention";

type EventStatus =
  | "stored"
  | "duplicate"
  | "rejected"
  | "failed_transient"
  | "failed_permanent"
  | "replayed"
  | "cleanup_success"
  | "cleanup_failed";

type ErrorCategory = "transient" | "permanent";
type FailureStage = "account_lookup" | "store_message";
type FailureStatus = "pending" | "replayed" | "duplicate" | "failed_permanent" | "abandoned";
type MessageStoreResult = "stored" | "duplicate";
type JobName = "replay_failures" | "cleanup_retention";

type ParsedProcessingResult =
  | {
      status: "stored" | "duplicate";
      stage: "store_message";
      resolvedMessageId: string;
    }
  | {
      status: "rejected";
      stage: "account_lookup";
      resolvedMessageId: string;
      rejectMessage: string;
    };

interface MailboxAccount {
  user_id: string;
  status: string;
}

interface StoredMessage {
  owner_user_id: string;
  owner_email_address: string;
  message_id_header: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  text_body: string | null;
  html_body_sanitized: string | null;
  size_bytes: number | null;
  headers_json: Record<string, string> | null;
}

interface IngestionEventPayload {
  recipient_address: string | null;
  sender_address: string | null;
  resolved_message_id: string | null;
  stage: EventStage;
  status: EventStatus;
  error_category?: ErrorCategory;
  error_message?: string;
  metadata_json?: Record<string, unknown>;
}

interface IngestionFailurePayload {
  recipient_address: string;
  sender_address: string;
  resolved_message_id: string;
  stage: FailureStage;
  status: FailureStatus;
  raw_email: string;
  retry_count: number;
  next_retry_at: string;
  last_error?: string;
  updated_at: string;
}

interface IngestionFailureRecord {
  id: string;
  recipient_address: string;
  sender_address: string;
  resolved_message_id: string;
  stage: FailureStage;
  status: FailureStatus;
  raw_email: string;
  retry_count: number;
  next_retry_at: string;
  last_error?: string;
}

interface JobRunRecord {
  id: string;
}

interface RetentionCleanupSummary {
  deleted_messages_count: number;
  deleted_events_count: number;
  deleted_failures_count: number;
  deleted_job_runs_count: number;
}

class TransientProcessingError extends Error {
  readonly stage: FailureStage;

  constructor(stage: FailureStage, message: string) {
    super(message);
    this.name = "TransientProcessingError";
    this.stage = stage;
  }
}

class PermanentProcessingError extends Error {
  readonly stage: FailureStage;

  constructor(stage: FailureStage, message: string) {
    super(message);
    this.name = "PermanentProcessingError";
    this.stage = stage;
  }
}

export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const recipient = message.to.trim().toLowerCase();
  const sender = message.from.trim().toLowerCase();
  const mailDomain = env.MAIL_DOMAIN?.trim().toLowerCase();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !mailDomain) {
    console.error("Missing required worker configuration");
    message.setReject("Mailbox unavailable");
    return;
  }

  if (getEmailDomain(recipient) !== mailDomain) {
    await safeRecordEvent(env, {
      recipient_address: recipient,
      sender_address: sender,
      resolved_message_id: null,
      stage: "domain_validation",
      status: "rejected",
      error_category: "permanent",
      error_message: "Recipient outside configured domain",
    });
    message.setReject("Recipient not found");
    return;
  }

  let rawEmail = "";
  let parsed: EmailData;

  try {
    rawEmail = await streamToString(message.raw, MAX_RAW_EMAIL_SIZE_BYTES);
    parsed = parseEmail(rawEmail);
  } catch (error) {
    console.error("Failed to parse email");
    await safeRecordEvent(env, {
      recipient_address: recipient,
      sender_address: sender,
      resolved_message_id: null,
      stage: "parse_email",
      status: "rejected",
      error_category: "permanent",
      error_message: normalizeErrorMessage(error),
    });
    message.setReject("Failed to parse message");
    return;
  }

  const processing = await processLiveDelivery(env, recipient, sender, rawEmail, parsed).catch(
    async (error: unknown) => {
      if (error instanceof TransientProcessingError) {
        const resolvedMessageId = await resolveMessageId(recipient, sender, parsed);

        await safeRecordFailure(env, {
          recipient_address: recipient,
          sender_address: sender,
          resolved_message_id: resolvedMessageId,
          stage: error.stage,
          status: "pending",
          raw_email: rawEmail,
          retry_count: 0,
          next_retry_at: calculateNextRetryAt(0),
          last_error: error.message,
          updated_at: nowIso(),
        });
        await safeRecordEvent(env, {
          recipient_address: recipient,
          sender_address: sender,
          resolved_message_id: resolvedMessageId,
          stage: error.stage,
          status: "failed_transient",
          error_category: "transient",
          error_message: error.message,
        });
      }

      if (error instanceof PermanentProcessingError) {
        const resolvedMessageId = await resolveMessageId(recipient, sender, parsed);

        await safeRecordEvent(env, {
          recipient_address: recipient,
          sender_address: sender,
          resolved_message_id: resolvedMessageId,
          stage: error.stage,
          status: "failed_permanent",
          error_category: "permanent",
          error_message: error.message,
        });
        message.setReject("Mailbox unavailable");
        return null;
      }

      throw error;
    }
  );

  if (!processing) {
    return;
  }

  if (processing.status === "rejected") {
    await safeRecordEvent(env, {
      recipient_address: recipient,
      sender_address: sender,
      resolved_message_id: processing.resolvedMessageId,
      stage: processing.stage,
      status: "rejected",
      error_category: "permanent",
      error_message:
        processing.rejectMessage === "Recipient not found"
          ? "No active mailbox for recipient"
          : "Mailbox unavailable for recipient",
    });
    message.setReject(processing.rejectMessage);
    return;
  }

  await safeRecordEvent(env, {
    recipient_address: recipient,
    sender_address: sender,
    resolved_message_id: processing.resolvedMessageId,
    stage: processing.stage,
    status: processing.status,
  });
}

export async function handleScheduled(controller: ScheduledController, env: Env): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.MAIL_DOMAIN) {
    console.error("Missing required worker configuration for scheduled task");
    return;
  }

  if (controller.cron === REPLAY_FAILURES_CRON) {
    await runReplayFailures(env);
    return;
  }

  if (controller.cron === CLEANUP_RETENTION_CRON) {
    await runRetentionCleanup(env);
  }
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await handleEmail(message, env);
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await handleScheduled(controller, env);
  },
} satisfies ExportedHandler<Env>;

async function processLiveDelivery(
  env: Env,
  recipient: string,
  sender: string,
  rawEmail: string,
  parsed: EmailData
): Promise<ParsedProcessingResult> {
  return processParsedDelivery(env, recipient, sender, rawEmail, parsed);
}

async function processParsedDelivery(
  env: Env,
  recipient: string,
  sender: string,
  _rawEmail: string,
  parsed: EmailData
): Promise<ParsedProcessingResult> {
  const filteredHeaders = filterHeaders(parsed.headers);
  const resolvedMessageId =
    parsed.messageId ?? (await syntheticMessageId(recipient, sender, parsed, filteredHeaders));
  const account = await lookupAccount(env, recipient);

  if (!account) {
    return {
      status: "rejected",
      stage: "account_lookup",
      resolvedMessageId,
      rejectMessage: "Recipient not found",
    };
  }

  if (account.status !== "active") {
    return {
      status: "rejected",
      stage: "account_lookup",
      resolvedMessageId,
      rejectMessage: "Mailbox unavailable",
    };
  }

  const storeResult = await storeMessage(env, {
    owner_user_id: account.user_id,
    owner_email_address: recipient,
    message_id_header: resolvedMessageId,
    from_address: sender,
    to_address: recipient,
    subject: parsed.subject,
    text_body: parsed.textBody ?? (parsed.htmlBody ? htmlToPlainText(parsed.htmlBody) : null),
    html_body_sanitized: null,
    size_bytes: parsed.sizeBytes,
    headers_json: filteredHeaders,
  });

  return {
    status: storeResult,
    stage: "store_message",
    resolvedMessageId,
  };
}

async function runReplayFailures(env: Env): Promise<void> {
  const startedAt = nowIso();
  const jobRun = await safeStartJobRun(env, "replay_failures", startedAt);
  const summary = {
    processed_count: 0,
    replayed_count: 0,
    duplicate_count: 0,
    abandoned_count: 0,
    pending_count: 0,
    permanent_count: 0,
    deferred_count: 0,
  };

  try {
    for (let batchIndex = 0; batchIndex < MAX_REPLAY_BATCHES_PER_RUN; batchIndex += 1) {
      const failures = await getPendingFailures(env, REPLAY_BATCH_SIZE);

      summary.processed_count += failures.length;

      for (const failure of failures) {
        const result = await replayFailure(env, failure);

        if (result === "replayed") {
          summary.replayed_count += 1;
        } else if (result === "duplicate") {
          summary.duplicate_count += 1;
        } else if (result === "abandoned") {
          summary.abandoned_count += 1;
        } else if (result === "pending") {
          summary.pending_count += 1;
        } else if (result === "failed_permanent") {
          summary.permanent_count += 1;
        }
      }

      if (failures.length < REPLAY_BATCH_SIZE) {
        break;
      }

      if (batchIndex === MAX_REPLAY_BATCHES_PER_RUN - 1) {
        summary.deferred_count += 1;
      }
    }

    await safeFinishJobRun(env, jobRun, "success", summary, startedAt);
  } catch (error) {
    await safeFinishJobRun(
      env,
      jobRun,
      "failed",
      summary,
      startedAt,
      normalizeErrorMessage(error)
    );
    throw error;
  }
}

async function replayFailure(
  env: Env,
  failure: IngestionFailureRecord
): Promise<FailureStatus | "pending"> {
  if (failure.retry_count >= MAX_REPLAY_ATTEMPTS) {
    await patchFailure(env, failure.id, {
      status: "abandoned",
      last_error: "Retry limit exceeded",
      updated_at: nowIso(),
    });

    return "abandoned";
  }

  let parsed: EmailData;

  try {
    parsed = parseEmail(failure.raw_email);
  } catch (error) {
    await patchFailure(env, failure.id, {
      status: "failed_permanent",
      last_error: normalizeErrorMessage(error),
      updated_at: nowIso(),
    });
    await safeRecordEvent(env, {
      recipient_address: failure.recipient_address,
      sender_address: failure.sender_address,
      resolved_message_id: failure.resolved_message_id,
      stage: "parse_email",
      status: "failed_permanent",
      error_category: "permanent",
      error_message: normalizeErrorMessage(error),
    });

    return "failed_permanent";
  }

  try {
    const result = await processParsedDelivery(
      env,
      failure.recipient_address,
      failure.sender_address,
      failure.raw_email,
      parsed
    );

    if (result.status === "rejected") {
      await patchFailure(env, failure.id, {
        status: "failed_permanent",
        last_error: result.rejectMessage,
        updated_at: nowIso(),
      });
      await safeRecordEvent(env, {
        recipient_address: failure.recipient_address,
        sender_address: failure.sender_address,
        resolved_message_id: result.resolvedMessageId,
        stage: result.stage,
        status: "failed_permanent",
        error_category: "permanent",
        error_message: result.rejectMessage,
      });

      return "failed_permanent";
    }

    const failureStatus = result.status === "duplicate" ? "duplicate" : "replayed";
    await patchFailure(env, failure.id, {
      status: failureStatus,
      last_error: null,
      updated_at: nowIso(),
    });
    await safeRecordEvent(env, {
      recipient_address: failure.recipient_address,
      sender_address: failure.sender_address,
      resolved_message_id: result.resolvedMessageId,
      stage: result.stage,
      status: failureStatus === "duplicate" ? "duplicate" : "replayed",
    });

    return failureStatus;
  } catch (error) {
    if (error instanceof TransientProcessingError) {
      const retryCount = failure.retry_count + 1;
      await patchFailure(env, failure.id, {
        status: "pending",
        retry_count: retryCount,
        next_retry_at: calculateNextRetryAt(retryCount),
        last_error: error.message,
        updated_at: nowIso(),
      });
      await safeRecordEvent(env, {
        recipient_address: failure.recipient_address,
        sender_address: failure.sender_address,
        resolved_message_id: failure.resolved_message_id,
        stage: error.stage,
        status: "failed_transient",
        error_category: "transient",
        error_message: error.message,
      });

      return "pending";
    }

    if (error instanceof PermanentProcessingError) {
      await patchFailure(env, failure.id, {
        status: "failed_permanent",
        last_error: error.message,
        updated_at: nowIso(),
      });
      await safeRecordEvent(env, {
        recipient_address: failure.recipient_address,
        sender_address: failure.sender_address,
        resolved_message_id: failure.resolved_message_id,
        stage: error.stage,
        status: "failed_permanent",
        error_category: "permanent",
        error_message: error.message,
      });

      return "failed_permanent";
    }

    throw error;
  }
}

async function runRetentionCleanup(env: Env): Promise<void> {
  const startedAt = nowIso();
  const jobRun = await safeStartJobRun(env, "cleanup_retention", startedAt);

  try {
    const summary = await cleanupRetainedMessages(env);

    await safeRecordEvent(env, {
      recipient_address: null,
      sender_address: null,
      resolved_message_id: null,
      stage: "cleanup_retention",
      status: "cleanup_success",
      metadata_json: summary,
    });

    await safeFinishJobRun(env, jobRun, "success", summary, startedAt);
  } catch (error) {
    await safeRecordEvent(env, {
      recipient_address: null,
      sender_address: null,
      resolved_message_id: null,
      stage: "cleanup_retention",
      status: "cleanup_failed",
      error_category: "transient",
      error_message: normalizeErrorMessage(error),
    });

    await safeFinishJobRun(
      env,
      jobRun,
      "failed",
      {
        deleted_messages_count: 0,
        deleted_events_count: 0,
        deleted_failures_count: 0,
        deleted_job_runs_count: 0,
      },
      startedAt,
      normalizeErrorMessage(error)
    );
    throw error;
  }
}

async function cleanupRetainedMessages(env: Env): Promise<RetentionCleanupSummary> {
  const cutoff = new Date(Date.now() - RETENTION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const deletedMessagesCount = await deleteRetainedRows(
    env,
    "mail_messages",
    "received_at",
    cutoff,
    RETENTION_DELETE_BATCH_SIZE
  );
  const deletedEventsCount = await deleteRetainedRows(
    env,
    "mail_ingestion_events",
    "created_at",
    cutoff,
    RETENTION_DELETE_BATCH_SIZE
  );
  const deletedFailuresCount = await deleteRetainedRows(
    env,
    "mail_ingestion_failures",
    "created_at",
    cutoff,
    RETENTION_DELETE_BATCH_SIZE
  );
  const deletedJobRunsCount = await deleteRetainedRows(
    env,
    "mail_job_runs",
    "started_at",
    cutoff,
    RETENTION_DELETE_BATCH_SIZE
  );

  return {
    deleted_messages_count: deletedMessagesCount,
    deleted_events_count: deletedEventsCount,
    deleted_failures_count: deletedFailuresCount,
    deleted_job_runs_count: deletedJobRunsCount,
  };
}

async function getPendingFailures(env: Env, limit: number): Promise<IngestionFailureRecord[]> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/mail_ingestion_failures`);
  url.searchParams.set("status", "eq.pending");
  url.searchParams.set("next_retry_at", `lte.${nowIso()}`);
  url.searchParams.set(
    "select",
    "id,recipient_address,sender_address,resolved_message_id,stage,status,raw_email,retry_count,next_retry_at,last_error"
  );
  url.searchParams.set("order", "next_retry_at.asc");
  url.searchParams.set("limit", String(limit));

  const response = await fetchWithTimeout(url.toString(), {
    headers: createSupabaseHeaders(env),
  });

  if (!response.ok) {
    throw new Error(`Failed to load pending failures: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as IngestionFailureRecord[];
}
async function deleteRetainedRows(
  env: Env,
  tableName: string,
  timeColumn: string,
  cutoff: string,
  batchSize: number
): Promise<number> {
  let deletedCount = 0;

  for (
    let batchIndex = 0;
    batchIndex < MAX_RETENTION_DELETE_BATCHES_PER_TABLE;
    batchIndex += 1
  ) {
    const url = new URL(`${env.SUPABASE_URL}/rest/v1/${tableName}`);
    url.searchParams.set(timeColumn, `lt.${cutoff}`);
    url.searchParams.set("select", "id");
    url.searchParams.set("limit", String(batchSize));

    const response = await fetchWithTimeout(url.toString(), {
      method: "DELETE",
      headers: {
        ...createSupabaseHeaders(env),
        Prefer: "return=representation",
      },
    });

    if (!response.ok) {
      throw new Error(`Retention cleanup failed for ${tableName}: ${response.status} ${response.statusText}`);
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    deletedCount += rows.length;

    if (rows.length < batchSize) {
      break;
    }
  }

  return deletedCount;
}

async function startJobRun(env: Env, jobName: JobName, startedAt: string): Promise<JobRunRecord> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/mail_job_runs`);
  url.searchParams.set("select", "id");

  const response = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: {
      ...createSupabaseHeaders(env),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      job_name: jobName,
      status: "running",
      started_at: startedAt,
      updated_at: startedAt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start job run: ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as JobRunRecord[];
  const jobRun = rows[0];

  if (!jobRun) {
    throw new Error("Failed to create job run record");
  }

  return jobRun;
}

async function finishJobRun(
  env: Env,
  jobRunId: string,
  status: "success" | "failed",
  metadataJson: Record<string, unknown>,
  startedAt: string,
  errorMessage?: string
): Promise<void> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/mail_job_runs`);
  url.searchParams.set("id", `eq.${jobRunId}`);

  const finishedAt = nowIso();
  const response = await fetchWithTimeout(url.toString(), {
    method: "PATCH",
    headers: createSupabaseHeaders(env),
    body: JSON.stringify({
      status,
      metadata_json: {
        ...metadataJson,
        started_at: startedAt,
      },
      error_message: errorMessage ?? null,
      finished_at: finishedAt,
      updated_at: finishedAt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to finish job run: ${response.status} ${response.statusText}`);
  }
}

async function safeStartJobRun(
  env: Env,
  jobName: JobName,
  startedAt: string
): Promise<JobRunRecord | null> {
  try {
    return await startJobRun(env, jobName, startedAt);
  } catch (error) {
    console.error("Failed to persist job run start", {
      jobName,
      error: normalizeErrorMessage(error),
    });
    return null;
  }
}

async function safeFinishJobRun(
  env: Env,
  jobRun: JobRunRecord | null,
  status: "success" | "failed",
  metadataJson: Record<string, unknown>,
  startedAt: string,
  errorMessage?: string
): Promise<void> {
  if (!jobRun) {
    return;
  }

  try {
    await finishJobRun(env, jobRun.id, status, metadataJson, startedAt, errorMessage);
  } catch (error) {
    console.error("Failed to persist job run finish", {
      jobRunId: jobRun.id,
      status,
      error: normalizeErrorMessage(error),
    });
  }
}

async function recordEvent(env: Env, payload: IngestionEventPayload): Promise<void> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/mail_ingestion_events`);
  const response = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: {
      ...createSupabaseHeaders(env),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to record ingestion event: ${response.status} ${response.statusText}`);
  }
}

async function recordFailure(env: Env, payload: IngestionFailurePayload): Promise<void> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/mail_ingestion_failures`);
  url.searchParams.set("on_conflict", INGESTION_FAILURE_CONFLICT_COLUMNS);

  const response = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: {
      ...createSupabaseHeaders(env),
      Prefer: INGESTION_FAILURE_INSERT_PREFER,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Failed to record ingestion failure: ${response.status} ${response.statusText}`);
  }
}

async function safeRecordEvent(env: Env, payload: IngestionEventPayload): Promise<void> {
  try {
    await recordEvent(env, payload);
  } catch (error) {
    console.error("Failed to persist ingestion event", {
      stage: payload.stage,
      status: payload.status,
      error: normalizeErrorMessage(error),
    });
  }
}

async function safeRecordFailure(env: Env, payload: IngestionFailurePayload): Promise<void> {
  try {
    await recordFailure(env, payload);
  } catch (error) {
    console.error("Failed to persist ingestion failure", {
      stage: payload.stage,
      resolvedMessageId: payload.resolved_message_id,
      error: normalizeErrorMessage(error),
    });
  }
}

async function patchFailure(
  env: Env,
  failureId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/mail_ingestion_failures`);
  url.searchParams.set("id", `eq.${failureId}`);

  const response = await fetchWithTimeout(url.toString(), {
    method: "PATCH",
    headers: createSupabaseHeaders(env),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update ingestion failure: ${response.status} ${response.statusText}`);
  }
}

async function resolveMessageId(
  recipient: string,
  sender: string,
  parsed: EmailData
): Promise<string> {
  const filteredHeaders = filterHeaders(parsed.headers);
  return parsed.messageId ?? (await syntheticMessageId(recipient, sender, parsed, filteredHeaders));
}

async function lookupAccount(env: Env, email: string): Promise<MailboxAccount | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/mailbox_accounts`);
  url.searchParams.set("email_address", `eq.${email}`);
  url.searchParams.set("select", "user_id,status");

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), {
      headers: createSupabaseHeaders(env),
    });
  } catch (error) {
    throw new TransientProcessingError(
      "account_lookup",
      `Supabase lookup failed: ${normalizeErrorMessage(error)}`
    );
  }

  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) {
      throw new TransientProcessingError(
        "account_lookup",
        `Supabase lookup failed: ${response.status} ${response.statusText}`
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new PermanentProcessingError(
        "account_lookup",
        `Supabase lookup failed: ${response.status} ${response.statusText}`
      );
    }

    console.error("Supabase lookup failed", { recipient: email });
    return null;
  }

  const rows = (await response.json()) as MailboxAccount[];
  return rows.length > 0 ? rows[0] : null;
}

async function storeMessage(env: Env, data: StoredMessage): Promise<MessageStoreResult> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/mail_messages`);
  url.searchParams.set("on_conflict", MAIL_MESSAGE_CONFLICT_COLUMNS);

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), {
      method: "POST",
      headers: {
        ...createSupabaseHeaders(env),
        Prefer: MAIL_MESSAGE_INSERT_PREFER,
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw new TransientProcessingError(
      "store_message",
      `Supabase insert failed: ${normalizeErrorMessage(error)}`
    );
  }

  if (response.ok) {
    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows.length === 0 ? "duplicate" : "stored";
  }

  if (response.status >= 500 || response.status === 429) {
    throw new TransientProcessingError(
      "store_message",
      `Supabase insert failed: ${response.status} ${response.statusText}`
    );
  }

  throw new PermanentProcessingError(
    "store_message",
    `Supabase insert failed: ${response.status} ${response.statusText}`
  );
}

function createSupabaseHeaders(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function streamToString(
  stream: ReadableStream,
  maxBytes = MAX_RAW_EMAIL_SIZE_BYTES
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error("Email exceeds size limit");
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}

function getEmailDomain(email: string): string | null {
  const parts = email.split("@");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return parts[1];
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function filterHeaders(headers: Record<string, string> | null): Record<string, string> | null {
  if (!headers) {
    return null;
  }

  const allowedHeaders = [
    "date",
    "from",
    "to",
    "cc",
    "reply-to",
    "in-reply-to",
    "subject",
    "message-id",
    "mime-version",
  ];
  const filteredHeaders = Object.fromEntries(
    Object.entries(headers).filter(([key]) => allowedHeaders.includes(key))
  );

  return Object.keys(filteredHeaders).length > 0 ? filteredHeaders : null;
}

async function syntheticMessageId(
  recipient: string,
  sender: string,
  parsed: EmailData,
  filteredHeaders: Record<string, string> | null
): Promise<string> {
  const fingerprint = JSON.stringify({
    recipient,
    sender,
    subject: parsed.subject,
    textBody: parsed.textBody,
    htmlBody: parsed.htmlBody,
    headers: filteredHeaders,
  });

  return `synthetic:${await hashString(fingerprint)}`;
}

async function hashString(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function calculateNextRetryAt(retryCount: number): string {
  const delayMs = RETRY_BASE_DELAY_MS * Math.max(1, 2 ** retryCount);
  return new Date(Date.now() + delayMs).toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}
