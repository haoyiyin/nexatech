import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminSessionMock,
  getAdminDashboardMetricsMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  getAdminDashboardMetricsMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/admin/dashboard/get-admin-dashboard-metrics", () => ({
  getAdminDashboardMetrics: getAdminDashboardMetricsMock,
}));

import { GET } from "./route";

describe("GET /api/admin/dashboard", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    getAdminDashboardMetricsMock.mockReset();
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123" });
  });

  it("returns dashboard metrics for active admins", async () => {
    getAdminDashboardMetricsMock.mockResolvedValue({
      activeMailboxCount: 42,
      suspendedMailboxCount: 3,
      messagesReceivedLast24Hours: 18,
      failedInboundLast24Hours: 2,
      lastCleanupJob: {
        status: "success",
        startedAt: "2026-04-20T03:17:00.000Z",
        finishedAt: "2026-04-20T03:17:10.000Z",
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        activeMailboxCount: 42,
        suspendedMailboxCount: 3,
        messagesReceivedLast24Hours: 18,
        failedInboundLast24Hours: 2,
        lastCleanupJob: {
          status: "success",
          startedAt: "2026-04-20T03:17:00.000Z",
          finishedAt: "2026-04-20T03:17:10.000Z",
        },
      },
    });
  });

  it("returns 401 when admin access is not available", async () => {
    requireAdminSessionMock.mockRejectedValue(new Error("NEXT_REDIRECT:/admin/login"));

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Not authenticated. Please sign in again.",
    });
  });

  it("returns 500 when metrics loading fails", async () => {
    getAdminDashboardMetricsMock.mockRejectedValue(new Error("metrics failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Failed to load dashboard metrics.",
    });
  });
});
