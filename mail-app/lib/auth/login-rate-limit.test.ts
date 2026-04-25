import { describe, expect, it } from "vitest";
import {
  getActiveRateLimitEntry,
  getRateLimitKeys,
  getRateLimitRetryAfterSeconds,
  isRateLimitExceeded,
  type LoginRateLimitEntry,
} from "./login-rate-limit";

describe("login-rate-limit", () => {
  it("builds scoped email and ip keys", () => {
    expect(getRateLimitKeys("student@nexatech.edu.kg", "127.0.0.1")).toEqual({
      emailKey: "login:email:student@nexatech.edu.kg",
      ipKey: "login:ip:127.0.0.1",
    });
    expect(getRateLimitKeys("student@nexatech.edu.kg", "127.0.0.1", "password-change")).toEqual({
      emailKey: "password-change:email:student@nexatech.edu.kg",
      ipKey: "password-change:ip:127.0.0.1",
    });
  });

  it("returns an active entry when reset time is in the future", () => {
    const entries: LoginRateLimitEntry[] = [
      {
        key: "login:email:student@nexatech.edu.kg",
        attempts: 3,
        reset_at: "2099-01-01T00:00:00.000Z",
      },
    ];

    expect(getActiveRateLimitEntry(entries, "login:email:student@nexatech.edu.kg", Date.now())).toEqual(
      entries[0]
    );
  });

  it("ignores expired entries", () => {
    const entries: LoginRateLimitEntry[] = [
      {
        key: "login:ip:127.0.0.1",
        attempts: 99,
        reset_at: "2000-01-01T00:00:00.000Z",
      },
    ];

    expect(getActiveRateLimitEntry(entries, "login:ip:127.0.0.1", Date.now())).toBeNull();
  });

  it("blocks only when attempts reach the max", () => {
    expect(isRateLimitExceeded(null, 5)).toBe(false);
    expect(
      isRateLimitExceeded(
        {
          key: "email:student@nexatech.edu.kg",
          attempts: 4,
          reset_at: "2099-01-01T00:00:00.000Z",
        },
        5
      )
    ).toBe(false);
    expect(
      isRateLimitExceeded(
        {
          key: "email:student@nexatech.edu.kg",
          attempts: 5,
          reset_at: "2099-01-01T00:00:00.000Z",
        },
        5
      )
    ).toBe(true);
  });

  it("returns retry-after seconds for an active entry", () => {
    expect(
      getRateLimitRetryAfterSeconds(
        {
          key: "login:email:student@nexatech.edu.kg",
          attempts: 5,
          reset_at: "2026-01-01T00:02:00.000Z",
        },
        Date.parse("2026-01-01T00:00:00.000Z")
      )
    ).toBe(120);
  });

  it("returns null retry-after for expired or missing entries", () => {
    expect(
      getRateLimitRetryAfterSeconds(
        {
          key: "login:email:student@nexatech.edu.kg",
          attempts: 5,
          reset_at: "2026-01-01T00:00:00.000Z",
        },
        Date.parse("2026-01-01T00:01:00.000Z")
      )
    ).toBeNull();
    expect(getRateLimitRetryAfterSeconds(null, Date.now())).toBeNull();
  });
});
