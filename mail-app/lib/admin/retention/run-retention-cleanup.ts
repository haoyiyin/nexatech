import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_RETENTION_DAYS = 30;

const RETENTION_DELETE_BATCH_SIZE = 100;
const MAX_RETENTION_DELETE_BATCHES_PER_TABLE = 100;
const MISSING_TABLE_ERROR_CODE = "PGRST205";

export interface RetentionCleanupSummary {
  deleted_messages_count: number;
  deleted_events_count: number;
  deleted_failures_count: number;
  deleted_job_runs_count: number;
  deleted_rate_limits_count: number;
}

interface JobRunRecord {
  id: string;
}

export async function runRetentionCleanup({
  retentionDays,
}: {
  retentionDays: number;
}): Promise<RetentionCleanupSummary> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();
  const jobRun = await safeStartJobRun(supabase, startedAt);

  try {
    const summary = await cleanupRetainedMessages(supabase, retentionDays);
    const summaryMetadata = {
      ...summary,
    } satisfies Record<string, unknown>;

    await safeRecordEvent(supabase, {
      recipient_address: null,
      sender_address: null,
      resolved_message_id: null,
      stage: "cleanup_retention",
      status: "cleanup_success",
      metadata_json: summaryMetadata,
    });

    await safeFinishJobRun(supabase, jobRun, "success", summaryMetadata, startedAt);

    return summary;
  } catch (error) {
    await safeRecordEvent(supabase, {
      recipient_address: null,
      sender_address: null,
      resolved_message_id: null,
      stage: "cleanup_retention",
      status: "cleanup_failed",
      error_category: "transient",
      error_message: normalizeErrorMessage(error),
    });

    await safeFinishJobRun(
      supabase,
      jobRun,
      "failed",
      {
        deleted_messages_count: 0,
        deleted_events_count: 0,
        deleted_failures_count: 0,
        deleted_job_runs_count: 0,
        deleted_rate_limits_count: 0,
      },
      startedAt,
      normalizeErrorMessage(error)
    );

    throw error;
  }
}

async function cleanupRetainedMessages(
  supabase: ReturnType<typeof createAdminClient>,
  retentionDays: number
): Promise<RetentionCleanupSummary> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const deletedMessagesCount = await deleteRetainedRows(
    supabase,
    "mail_messages",
    "received_at",
    cutoff,
    RETENTION_DELETE_BATCH_SIZE
  );
  const deletedEventsCount = await deleteRetainedRows(
    supabase,
    "mail_ingestion_events",
    "created_at",
    cutoff,
    RETENTION_DELETE_BATCH_SIZE,
    true
  );
  const deletedFailuresCount = await deleteRetainedRows(
    supabase,
    "mail_ingestion_failures",
    "created_at",
    cutoff,
    RETENTION_DELETE_BATCH_SIZE,
    true
  );
  const deletedJobRunsCount = await deleteRetainedRows(
    supabase,
    "mail_job_runs",
    "started_at",
    cutoff,
    RETENTION_DELETE_BATCH_SIZE,
    true
  );

  const deletedRateLimitsCount = await deleteExpiredRateLimits(supabase);

  return {
    deleted_messages_count: deletedMessagesCount,
    deleted_events_count: deletedEventsCount,
    deleted_failures_count: deletedFailuresCount,
    deleted_job_runs_count: deletedJobRunsCount,
    deleted_rate_limits_count: deletedRateLimitsCount,
  };
}

async function deleteRetainedRows(
  supabase: ReturnType<typeof createAdminClient>,
  tableName: string,
  timeColumn: string,
  cutoff: string,
  batchSize: number,
  allowMissingTable = false
): Promise<number> {
  let deletedCount = 0;

  for (let batchIndex = 0; batchIndex < MAX_RETENTION_DELETE_BATCHES_PER_TABLE; batchIndex += 1) {
    const { data: deletedRows, error } = await supabase
      .from(tableName)
      .delete()
      .lt(timeColumn, cutoff)
      .select("id")
      .limit(batchSize);

    if (error) {
      if (allowMissingTable && isMissingTableError(error)) {
        return 0;
      }

      throw new Error(`Retention cleanup failed for ${tableName}: ${error.message}`);
    }

    const rows = deletedRows ?? [];
    deletedCount += rows.length;

    if (rows.length < batchSize) {
      break;
    }
  }

  return deletedCount;
}

async function safeStartJobRun(
  supabase: ReturnType<typeof createAdminClient>,
  startedAt: string
): Promise<JobRunRecord | null> {
  try {
    const { data, error } = await supabase
      .from("mail_job_runs")
      .insert({
        job_name: "cleanup_retention",
        status: "running",
        started_at: startedAt,
        updated_at: startedAt,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to start job run.");
    }

    return data;
  } catch {
    return null;
  }
}

async function safeFinishJobRun(
  supabase: ReturnType<typeof createAdminClient>,
  jobRun: JobRunRecord | null,
  status: "success" | "failed",
  metadataJson: Record<string, unknown>,
  startedAt: string,
  errorMessage?: string
): Promise<void> {
  if (!jobRun) {
    return;
  }

  const finishedAt = new Date().toISOString();

  try {
    await supabase
      .from("mail_job_runs")
      .update({
        status,
        metadata_json: {
          ...metadataJson,
          started_at: startedAt,
        },
        error_message: errorMessage ?? null,
        finished_at: finishedAt,
        updated_at: finishedAt,
      })
      .eq("id", jobRun.id);
  } catch {
    // Fail open so cleanup is not blocked by observability issues.
  }
}

async function safeRecordEvent(
  supabase: ReturnType<typeof createAdminClient>,
  payload: {
    recipient_address: string | null;
    sender_address: string | null;
    resolved_message_id: string | null;
    stage: string;
    status: string;
    error_category?: string;
    error_message?: string;
    metadata_json?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from("mail_ingestion_events").insert(payload);
  } catch {
    // Fail open so cleanup is not blocked by event persistence issues.
  }
}

async function deleteExpiredRateLimits(
  supabase: ReturnType<typeof createAdminClient>
): Promise<number> {
  const now = new Date().toISOString();
  let deletedCount = 0;

  for (let batchIndex = 0; batchIndex < MAX_RETENTION_DELETE_BATCHES_PER_TABLE; batchIndex += 1) {
    const { data: deletedRows, error } = await supabase
      .from("login_rate_limits")
      .delete()
      .lt("reset_at", now)
      .select("key")
      .limit(RETENTION_DELETE_BATCH_SIZE);

    if (error) {
      if (isMissingTableError(error)) {
        return 0;
      }

      throw new Error(`Retention cleanup failed for login_rate_limits: ${(error as Error).message}`);
    }

    const rows = deletedRows ?? [];
    deletedCount += rows.length;

    if (rows.length < RETENTION_DELETE_BATCH_SIZE) {
      break;
    }
  }

  return deletedCount;
}

function isMissingTableError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === MISSING_TABLE_ERROR_CODE;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}
