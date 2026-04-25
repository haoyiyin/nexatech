import {
  RATE_LIMIT_WINDOW_MS,
  type LoginRateLimitEntry,
} from "@/lib/auth/login-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getLoginRateLimitEntries(keys: string[]) {
  if (keys.length === 0) {
    return [] satisfies LoginRateLimitEntry[];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("login_rate_limits")
    .select("key, attempts, reset_at")
    .in("key", keys);

  if (error) {
    throw new Error("Failed to load login rate limits.");
  }

  return (data ?? []) satisfies LoginRateLimitEntry[];
}

export async function incrementLoginRateLimit(key: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("increment_login_rate_limit", {
    p_key: key,
    p_window_ms: RATE_LIMIT_WINDOW_MS,
  });

  if (error) {
    throw new Error("Failed to update login rate limits.");
  }
}

export async function clearLoginRateLimit(key: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("login_rate_limits").delete().eq("key", key);

  if (error) {
    throw new Error("Failed to clear login rate limits.");
  }
}
