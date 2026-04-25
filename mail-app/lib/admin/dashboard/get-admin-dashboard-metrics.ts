import { createAdminClient } from "@/lib/supabase/admin";

const MISSING_TABLE_ERROR_CODE = "PGRST205";

export interface AdminDashboardMetrics {
  activeMailboxCount: number;
  suspendedMailboxCount: number;
  messagesReceivedLast24Hours: number;
  failedInboundLast24Hours: number;
  lastCleanupJob: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
  } | null;
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const supabase = createAdminClient();
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: activeMailboxCount, error: activeMailboxError },
    { count: suspendedMailboxCount, error: suspendedMailboxError },
    { count: messagesReceivedLast24Hours, error: messagesError },
    failedInboundResult,
    lastCleanupJobResult,
  ] = await Promise.all([
    supabase.from("mailbox_accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("mailbox_accounts")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
    supabase
      .from("mail_messages")
      .select("id", { count: "exact", head: true })
      .gte("received_at", last24Hours),
    supabase
      .from("mail_ingestion_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed_transient")
      .gte("created_at", last24Hours),
    supabase
      .from("mail_job_runs")
      .select("status, started_at, finished_at")
      .eq("job_name", "cleanup_retention")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (activeMailboxError || suspendedMailboxError || messagesError) {
    throw new Error("Failed to load dashboard metrics.");
  }

  const failedInboundError =
    failedInboundResult.error && failedInboundResult.error.code !== MISSING_TABLE_ERROR_CODE
      ? failedInboundResult.error
      : null;
  const lastCleanupJobError =
    lastCleanupJobResult.error && lastCleanupJobResult.error.code !== MISSING_TABLE_ERROR_CODE
      ? lastCleanupJobResult.error
      : null;

  if (failedInboundError || lastCleanupJobError) {
    throw new Error("Failed to load dashboard metrics.");
  }

  return {
    activeMailboxCount: activeMailboxCount ?? 0,
    suspendedMailboxCount: suspendedMailboxCount ?? 0,
    messagesReceivedLast24Hours: messagesReceivedLast24Hours ?? 0,
    failedInboundLast24Hours:
      failedInboundResult.error?.code === MISSING_TABLE_ERROR_CODE
        ? 0
        : failedInboundResult.count ?? 0,
    lastCleanupJob:
      lastCleanupJobResult.error?.code === MISSING_TABLE_ERROR_CODE || !lastCleanupJobResult.data
        ? null
        : {
            status: lastCleanupJobResult.data.status,
            startedAt: lastCleanupJobResult.data.started_at,
            finishedAt: lastCleanupJobResult.data.finished_at,
          },
  };
}
