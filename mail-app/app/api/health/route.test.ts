import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  fromMock,
  selectMock,
  limitMock,
  getLoginRateLimitEntriesMock,
  incrementLoginRateLimitMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  limitMock: vi.fn(),
  getLoginRateLimitEntriesMock: vi.fn(),
  incrementLoginRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

vi.mock("@/lib/auth/login-rate-limit-store", () => ({
  getLoginRateLimitEntries: getLoginRateLimitEntriesMock,
  incrementLoginRateLimit: incrementLoginRateLimitMock,
}));

import { GET } from "./route";

function createHealthRequest(headers?: Record<string, string>) {
  return new NextRequest("https://www.nexatech.edu.kg/mail/api/health", {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      ...headers,
    },
  });
}

describe("GET /api/health", () => {
  beforeEach(() => {
    fromMock.mockReset();
    selectMock.mockReset();
    limitMock.mockReset();
    getLoginRateLimitEntriesMock.mockReset();
    incrementLoginRateLimitMock.mockReset();

    fromMock.mockReturnValue({
      select: selectMock,
    });

    selectMock.mockReturnValue({
      limit: limitMock,
    });

    getLoginRateLimitEntriesMock.mockResolvedValue([]);
    incrementLoginRateLimitMock.mockResolvedValue(undefined);
  });

  it("returns a healthy response when Supabase is reachable", async () => {
    limitMock.mockResolvedValue({ error: null });

    const response = await GET(createHealthRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      success: true,
      status: "healthy",
      timestamp: expect.any(String),
      checks: {
        supabase: "ok",
      },
    });
    expect(incrementLoginRateLimitMock).toHaveBeenCalledWith("health:ip:203.0.113.10");
  });

  it("returns 429 when health checks exceed the IP rate limit", async () => {
    getLoginRateLimitEntriesMock.mockResolvedValue([
      {
        key: "health:ip:203.0.113.10",
        attempts: 60,
        reset_at: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);

    const response = await GET(createHealthRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      success: false,
      status: "rate_limited",
      timestamp: expect.any(String),
      error: "Too many health checks. Please try again shortly.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("continues when health rate-limit storage is unavailable", async () => {
    getLoginRateLimitEntriesMock.mockRejectedValue(new Error("store unavailable"));
    limitMock.mockResolvedValue({ error: null });

    const response = await GET(createHealthRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      status: "healthy",
      timestamp: expect.any(String),
      checks: {
        supabase: "ok",
      },
    });
  });

  it("returns an unhealthy response when Supabase check fails", async () => {
    limitMock.mockResolvedValue({ error: { message: "down" } });

    const response = await GET(createHealthRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      status: "unhealthy",
      timestamp: expect.any(String),
      checks: {
        supabase: "error",
      },
      error: "Supabase health check failed.",
    });
  });
});
