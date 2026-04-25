import { jsonResponse } from "@/lib/auth/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveRateLimitEntry, getRateLimitRetryAfterSeconds, isRateLimitExceeded } from "@/lib/auth/login-rate-limit";
import { getClientIp } from "@/lib/auth/api-helpers";
import { getLoginRateLimitEntries, incrementLoginRateLimit } from "@/lib/auth/login-rate-limit-store";
import type { NextRequest } from "next/server";

const HEALTH_RATE_LIMIT_SCOPE = "health";
const HEALTH_MAX_IP_ATTEMPTS = 60;

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  const clientIp = getClientIp(request);
  const ipKey = `${HEALTH_RATE_LIMIT_SCOPE}:ip:${clientIp}`;

  try {
    const entries = await getLoginRateLimitEntries([ipKey]);
    const ipEntry = getActiveRateLimitEntry(entries, ipKey);

    if (isRateLimitExceeded(ipEntry, HEALTH_MAX_IP_ATTEMPTS)) {
      const retryAfterSeconds = getRateLimitRetryAfterSeconds(ipEntry) ?? 60;

      return jsonResponse(
        {
          success: false,
          status: "rate_limited",
          timestamp,
          error: "Too many health checks. Please try again shortly.",
        },
        429,
        {
          "Retry-After": String(retryAfterSeconds),
        }
      );
    }

    await incrementLoginRateLimit(ipKey);
  } catch {
    // Fail open so health checks remain available if rate-limit storage is unavailable.
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("mailbox_accounts").select("id", { head: true }).limit(1);

    if (error) {
      throw error;
    }

    return jsonResponse(
      {
        success: true,
        status: "healthy",
        timestamp,
        checks: {
          supabase: "ok",
        },
      },
      200
    );
  } catch (error) {
    console.error(
      "Health check failed",
      error instanceof Error ? error.message : "Unknown error"
    );

    return jsonResponse(
      {
        success: false,
        status: "unhealthy",
        timestamp,
        checks: {
          supabase: "error",
        },
        error: "Supabase health check failed.",
      },
      503
    );
  }
}
