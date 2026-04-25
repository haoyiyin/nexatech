import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRetentionCleanup } from "@/lib/admin/retention/run-retention-cleanup";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { isInvalidOriginRequest, jsonResponse } from "@/lib/auth/api-helpers";

const manualCleanupSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650),
});

const MANUAL_CLEANUP_COOLDOWN_MS = 60_000;
const MISSING_TABLE_ERROR_CODE = "PGRST205";

export async function POST(request: NextRequest) {
  if (isInvalidOriginRequest(request)) {
    return jsonResponse(
      {
        success: false,
        error: "Invalid request origin.",
      },
      403
    );
  }

  try {
    await requireAdminSession();
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Not authenticated. Please sign in again.",
      },
      401
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = manualCleanupSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      {
        success: false,
        error: "Please provide a valid retention window in days.",
      },
      400
    );
  }

  try {
    const supabase = createAdminClient();
    const { data: latestCleanupJob, error: latestCleanupJobError } = await supabase
      .from("mail_job_runs")
      .select("status, started_at")
      .eq("job_name", "cleanup_retention")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestCleanupJobError && latestCleanupJobError.code !== MISSING_TABLE_ERROR_CODE) {
      throw latestCleanupJobError;
    }

    if (latestCleanupJob?.status === "running") {
      return jsonResponse(
        {
          success: false,
          error: "A cleanup job is already running. Please wait for it to finish.",
        },
        409
      );
    }

    if (
      latestCleanupJob?.started_at &&
      Date.now() - Date.parse(latestCleanupJob.started_at) < MANUAL_CLEANUP_COOLDOWN_MS
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Please wait a minute before running cleanup again.",
        },
        429
      );
    }

    const summary = await runRetentionCleanup({
      retentionDays: parsed.data.retentionDays,
    });

    return jsonResponse(
      {
        success: true,
        data: summary,
      },
      200
    );
  } catch (error) {
    console.error("Retention cleanup failed:", error);
    return jsonResponse(
      {
        success: false,
        error: "Failed to run retention cleanup.",
      },
      500
    );
  }
}
