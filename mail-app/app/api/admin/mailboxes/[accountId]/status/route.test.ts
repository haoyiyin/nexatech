import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAdminSessionMock,
  updateMailboxStatusMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  updateMailboxStatusMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/admin/accounts/update-mailbox-status", () => ({
  updateMailboxStatus: updateMailboxStatusMock,
}));

import { POST } from "./route";

function createStatusRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest("https://www.nexatech.edu.kg/mail/api/admin/mailboxes/account-1/status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.nexatech.edu.kg",
      "cf-connecting-ip": "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/mailboxes/[accountId]/status", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    updateMailboxStatusMock.mockReset();
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123" });
  });

  it("updates mailbox status", async () => {
    updateMailboxStatusMock.mockResolvedValue({
      id: "account-1",
      status: "suspended",
    });

    const response = await POST(createStatusRequest({ status: "suspended" }), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: "account-1",
        status: "suspended",
      },
    });
    expect(updateMailboxStatusMock).toHaveBeenCalledWith({
      accountId: "account-1",
      status: "suspended",
    });
  });

  it("returns 400 for invalid status payloads", async () => {
    const response = await POST(createStatusRequest({ status: "archived" }), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Please provide a valid mailbox status.",
    });
  });

  it("returns 404 when the mailbox is missing", async () => {
    updateMailboxStatusMock.mockRejectedValue(
      Object.assign(new Error("Mailbox account not found."), {
        code: "MAILBOX_ACCOUNT_NOT_FOUND",
      })
    );

    const response = await POST(createStatusRequest({ status: "active" }), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Mailbox account not found.",
    });
  });

  it("returns 401 when admin session is invalid", async () => {
    requireAdminSessionMock.mockRejectedValue(new Error("Session expired"));

    const response = await POST(createStatusRequest({ status: "active" }), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Not authenticated. Please sign in again.",
    });
  });

  it("returns 403 when admin tries to change their own account status", async () => {
    requireAdminSessionMock.mockResolvedValue({
      id: "admin-user-123",
      mailboxAccountId: "account-1",
    });

    const response = await POST(createStatusRequest({ status: "suspended" }), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "You cannot change the status of your own account.",
    });
    expect(updateMailboxStatusMock).not.toHaveBeenCalled();
  });
});
