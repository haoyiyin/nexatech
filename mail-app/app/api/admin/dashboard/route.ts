import { getAdminDashboardMetrics } from "@/lib/admin/dashboard/get-admin-dashboard-metrics";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { jsonResponse } from "@/lib/auth/api-helpers";

export async function GET() {
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

  try {
    const metrics = await getAdminDashboardMetrics();

    return jsonResponse(
      {
        success: true,
        data: metrics,
      },
      200
    );
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Failed to load dashboard metrics.",
      },
      500
    );
  }
}
