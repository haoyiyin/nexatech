import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAdminSessionMock,
  runRetentionCleanupMock,
  createAdminClientMock,
  fromMock,
  selectMock,
  eqMock,
  orderMock,
  limitMock,
  maybeSingleMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  runRetentionCleanupMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  orderMock: vi.fn(),
  limitMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/admin/retention/run-retention-cleanup", () => ({
  runRetentionCleanup: runRetentionCleanupMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { POST } from "./route";

function createCleanupRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest("https://www.nexatech.edu.kg/mail/api/admin/retention/cleanup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.nexatech.edu.kg",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/retention/cleanup", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    runRetentionCleanupMock.mockReset();
    createAdminClientMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    orderMock.mockReset();
    limitMock.mockReset();
    maybeSingleMock.mockReset();

    requireAdminSessionMock.mockResolvedValue({ id: "admin-123", mailboxAccountId: "admin-account-1" });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    limitMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    orderMock.mockReturnValue({ limit: limitMock });
    eqMock.mockReturnValue({ order: orderMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });
    createAdminClientMock.mockReturnValue({ from: fromMock });
  });

  it("runs manual cleanup and returns the summary", async () => {
    runRetentionCleanupMock.mockResolvedValue({
      deleted_messages_count: 2,
      deleted_events_count: 1,
      deleted_failures_count: 1,
      deleted_job_runs_count: 0,
      deleted_rate_limits_count: 0,
    });

    const response = await POST(createCleanupRequest({ retentionDays: 45 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        deleted_messages_count: 2,
        deleted_events_count: 1,
        deleted_failures_count: 1,
        deleted_job_runs_count: 0,
        deleted_rate_limits_count: 0,
      },
    });
    expect(runRetentionCleanupMock).toHaveBeenCalledWith({ retentionDays: 45 });
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await POST(createCleanupRequest({ retentionDays: 0 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Please provide a valid retention window in days.",
    });
  });

  it("returns 401 when admin session is invalid", async () => {
    requireAdminSessionMock.mockRejectedValue(new Error("Session expired"));

    const response = await POST(createCleanupRequest({ retentionDays: 45 }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Not authenticated. Please sign in again.",
    });
  });

  it("returns 403 for invalid origins", async () => {
    const response = await POST(
      createCleanupRequest({ retentionDays: 45 }, { origin: "https://evil.example.com" })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid request origin.",
    });
  });

  it("returns 409 when a cleanup job is already running", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        status: "running",
        started_at: "2026-04-21T10:00:00.000Z",
      },
      error: null,
    });

    const response = await POST(createCleanupRequest({ retentionDays: 45 }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "A cleanup job is already running. Please wait for it to finish.",
    });
    expect(runRetentionCleanupMock).not.toHaveBeenCalled();
  });

  it("returns 429 when cleanup was started too recently", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        status: "success",
        started_at: new Date().toISOString(),
      },
      error: null,
    });

    const response = await POST(createCleanupRequest({ retentionDays: 45 }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Please wait a minute before running cleanup again.",
    });
    expect(runRetentionCleanupMock).not.toHaveBeenCalled();
  });

  it("ignores missing cleanup job table when deciding whether to run", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST205",
        message: "missing table",
      },
    });
    runRetentionCleanupMock.mockResolvedValue({
      deleted_messages_count: 1,
      deleted_events_count: 0,
      deleted_failures_count: 0,
      deleted_job_runs_count: 0,
      deleted_rate_limits_count: 0,
    });

    const response = await POST(createCleanupRequest({ retentionDays: 45 }));

    expect(response.status).toBe(200);
    expect(runRetentionCleanupMock).toHaveBeenCalledWith({ retentionDays: 45 });
  });

  it("returns 500 when cleanup fails", async () => {
    runRetentionCleanupMock.mockRejectedValue(new Error("cleanup failed"));

    const response = await POST(createCleanupRequest({ retentionDays: 45 }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Failed to run retention cleanup.",
    });
  });
});
