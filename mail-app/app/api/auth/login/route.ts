import {
  createServerClient,
  type CookieOptions,
  type CookieOptionsWithName,
} from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { z } from "zod";
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
import { createAdminClient } from "@/lib/supabase/admin";

const STUDENT_MAIL_DOMAIN = "@nexatech.edu.kg";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().endsWith(STUDENT_MAIL_DOMAIN),
  password: z.string().min(1),
});

async function revokeLoginSession(supabase: ReturnType<typeof createServerClient>) {
  await supabase.auth.signOut({ scope: "local" });
}

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

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      {
        success: false,
        error: "Please enter your @nexatech.edu.kg email address and password.",
      },
      400
    );
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const clientIp = getClientIp(request);
  const { emailKey, ipKey } = getRateLimitKeys(normalizedEmail, clientIp);

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
          error: "Too many sign-in attempts. Please try again in a few minutes.",
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
    // Fail open so auth remains available if rate-limit storage is temporarily unavailable.
  }

  const cookiesToApply: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];
  let supabase: ReturnType<typeof createServerClient> | null = null;
  let hasAuthenticatedSession = false;

  try {
    supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookies: Array<{
          name: string;
          value: string;
          options: CookieOptionsWithName;
        }>) {
          nextCookies.forEach(({ name, value, options }) => {
            cookiesToApply.push({
              name,
              value,
              options: {
                ...options,
                path: options.path ?? "/",
              },
            });
          });
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      await Promise.allSettled([
        incrementLoginRateLimit(emailKey),
        incrementLoginRateLimit(ipKey),
      ]);

      return jsonResponse(
        {
          success: false,
          error: "Invalid email or password. Please try again.",
        },
        401
      );
    }

    hasAuthenticatedSession = true;

    const adminClient = createAdminClient();
    const { data: mailboxAccount, error: mailboxAccountError } = await adminClient
      .from("mailbox_accounts")
      .select("status")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (mailboxAccountError) {
      throw mailboxAccountError;
    }

    if (!mailboxAccount || mailboxAccount.status !== "active") {
      await Promise.allSettled([
        revokeLoginSession(supabase),
        incrementLoginRateLimit(emailKey),
        incrementLoginRateLimit(ipKey),
      ]);

      return jsonResponse(
        {
          success: false,
          error: "Invalid email or password. Please try again.",
        },
        401
      );
    }

    await Promise.allSettled([clearLoginRateLimit(emailKey), clearLoginRateLimit(ipKey)]);

    const response = jsonResponse(
      {
        success: true,
        redirectTo: "/inbox",
      },
      200
    );

    cookiesToApply.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch {
    await Promise.allSettled([
      ...(hasAuthenticatedSession && supabase ? [revokeLoginSession(supabase)] : []),
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
}
