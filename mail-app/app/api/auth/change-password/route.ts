import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_EMAIL_ATTEMPTS,
  MAX_IP_ATTEMPTS,
  getActiveRateLimitEntry,
  getRateLimitKeys,
  getRateLimitRetryAfterSeconds,
  isRateLimitExceeded,
} from "@/lib/auth/login-rate-limit";
import {
  clearLoginRateLimit,
  getLoginRateLimitEntries,
  incrementLoginRateLimit,
} from "@/lib/auth/login-rate-limit-store";
import {
  getClientIp,
  isInvalidOriginRequest,
  jsonResponse,
} from "@/lib/auth/api-helpers";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  });

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

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return jsonResponse(
      {
        success: false,
        error: firstIssue?.message ?? "Invalid password change request.",
      },
      400
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(
      {
        success: false,
        error: "Authentication is temporarily unavailable.",
      },
      500
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return jsonResponse(
      {
        success: false,
        error: "Not authenticated. Please sign in again.",
      },
      401
    );
  }

  const clientIp = getClientIp(request);
  const { emailKey, ipKey } = getRateLimitKeys(user.email.toLowerCase(), clientIp, "password-change");

  try {
    const entries = await getLoginRateLimitEntries([emailKey, ipKey]);
    const emailEntry = getActiveRateLimitEntry(entries, emailKey);
    const ipEntry = getActiveRateLimitEntry(entries, ipKey);

    if (
      isRateLimitExceeded(emailEntry, MAX_EMAIL_ATTEMPTS) ||
      isRateLimitExceeded(ipEntry, MAX_IP_ATTEMPTS)
    ) {
      const retryAfterSeconds = Math.max(
        getRateLimitRetryAfterSeconds(emailEntry) ?? 0,
        getRateLimitRetryAfterSeconds(ipEntry) ?? 0
      );

      return jsonResponse(
        {
          success: false,
          error: "Too many password change attempts. Please try again in a few minutes.",
        },
        429,
        retryAfterSeconds > 0
          ? {
              "Retry-After": String(retryAfterSeconds),
            }
          : undefined
      );
    }
  } catch {
    // Fail open so authenticated users are not blocked if rate-limit storage is temporarily unavailable.
  }

  const verifyClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const verifyResult = await verifyClient.auth
    .signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    })
    .catch(() => null);

  if (!verifyResult) {
    await Promise.allSettled([
      incrementLoginRateLimit(emailKey),
      incrementLoginRateLimit(ipKey),
    ]);

    return jsonResponse(
      {
        success: false,
        error: "Authentication is temporarily unavailable.",
      },
      500
    );
  }

  const { data: verifyData, error: verifyError } = verifyResult;

  if (verifyError || !verifyData.session) {
    await Promise.allSettled([
      incrementLoginRateLimit(emailKey),
      incrementLoginRateLimit(ipKey),
    ]);

    return jsonResponse(
      {
        success: false,
        error: "Current password is incorrect.",
      },
      401
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return jsonResponse(
      {
        success: false,
        error: "New password must be different from your current password.",
      },
      400
    );
  }

  const adminClient = createAdminClient();

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    password: parsed.data.newPassword,
  });

  await verifyClient.auth.signOut({ scope: "local" });

  if (updateError) {
    await Promise.allSettled([
      incrementLoginRateLimit(emailKey),
      incrementLoginRateLimit(ipKey),
    ]);

    return jsonResponse(
      {
        success: false,
        error: "Failed to update password. Please try again.",
      },
      500
    );
  }

  await Promise.allSettled([clearLoginRateLimit(emailKey), clearLoginRateLimit(ipKey)]);

  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });

  if (signOutError) {
    return jsonResponse(
      {
        success: false,
        error: "Password updated, but we could not end your sessions. Please sign out manually.",
      },
      500
    );
  }

  return jsonResponse(
    {
      success: true,
    },
    200
  );
}
