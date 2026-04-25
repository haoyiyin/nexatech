import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminSessionMock,
  getAdminDashboardMetricsMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  getAdminDashboardMetricsMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/admin/dashboard/get-admin-dashboard-metrics", () => ({
  getAdminDashboardMetrics: getAdminDashboardMetricsMock,
}));

vi.mock("@/components/admin/dashboard-cards", () => ({
  default: "dashboard-cards",
}));

vi.mock("@/components/admin/manual-cleanup-form", () => ({
  default: "manual-cleanup-form",
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import AdminDashboardPage from "./page";

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    getAdminDashboardMetricsMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("redirects unauthenticated users", async () => {
    requireAdminSessionMock.mockRejectedValue(new Error("NEXT_REDIRECT:/admin/login"));

    await expect(AdminDashboardPage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("renders dashboard metrics", async () => {
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123" });
    getAdminDashboardMetricsMock.mockResolvedValue({
      activeMailboxCount: 10,
      suspendedMailboxCount: 2,
      messagesReceivedLast24Hours: 7,
      failedInboundLast24Hours: 1,
      lastCleanupJob: null,
    });

    const element = await AdminDashboardPage();
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];

    expect(children[1].type).toBe("dashboard-cards");
    expect(children[1].props.metrics).toEqual({
      activeMailboxCount: 10,
      suspendedMailboxCount: 2,
      messagesReceivedLast24Hours: 7,
      failedInboundLast24Hours: 1,
      lastCleanupJob: null,
    });
    expect(children[2].type).toBe("manual-cleanup-form");
  });

  it("renders fallback dashboard metrics when optional reliability tables are unavailable", async () => {
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123" });
    getAdminDashboardMetricsMock.mockResolvedValue({
      activeMailboxCount: 1,
      suspendedMailboxCount: 0,
      messagesReceivedLast24Hours: 0,
      failedInboundLast24Hours: 0,
      lastCleanupJob: null,
    });

    const element = await AdminDashboardPage();

    expect(element.props.children[1].props.metrics).toEqual({
      activeMailboxCount: 1,
      suspendedMailboxCount: 0,
      messagesReceivedLast24Hours: 0,
      failedInboundLast24Hours: 0,
      lastCleanupJob: null,
    });
  });
});
