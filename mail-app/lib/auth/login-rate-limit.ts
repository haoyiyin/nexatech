export const MAX_EMAIL_ATTEMPTS = 5;
export const MAX_IP_ATTEMPTS = 20;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

export interface LoginRateLimitEntry {
  key: string;
  attempts: number;
  reset_at: string;
}

export function getRateLimitKeys(email: string, ip: string, scope = "login") {
  return {
    emailKey: `${scope}:email:${email}`,
    ipKey: `${scope}:ip:${ip}`,
  };
}

export function getActiveRateLimitEntry(
  entries: LoginRateLimitEntry[],
  key: string,
  now = Date.now()
) {
  const entry = entries.find((candidate) => candidate.key === key);

  if (!entry) {
    return null;
  }

  return Date.parse(entry.reset_at) > now ? entry : null;
}

export function isRateLimitExceeded(
  entry: LoginRateLimitEntry | null,
  maxAttempts: number
) {
  if (!entry) {
    return false;
  }

  return entry.attempts >= maxAttempts;
}

export function getRateLimitRetryAfterSeconds(
  entry: LoginRateLimitEntry | null,
  now = Date.now()
) {
  if (!entry) {
    return null;
  }

  const resetAt = Date.parse(entry.reset_at);

  if (Number.isNaN(resetAt) || resetAt <= now) {
    return null;
  }

  return Math.ceil((resetAt - now) / 1000);
}
