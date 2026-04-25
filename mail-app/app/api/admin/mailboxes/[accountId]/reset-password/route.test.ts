import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAdminSessionMock,
  resetMailboxPasswordMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  resetMailboxPasswordMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/admin/accounts/reset-mailbox-password", () => ({
  resetMailboxPassword: resetMailboxPasswordMock,
}));

import { POST } from "./route";

function createResetPasswordRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest(
    "https://www.nexatech.edu.kg/mail/api/admin/mailboxes/account-1/reset-password",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://www.nexatech.edu.kg",
        "cf-connecting-ip": "203.0.113.10",
        ...headers,
      },
      body: JSON.stringify(body),
    }
  );
}

describe("POST /api/admin/mailboxes/[accountId]/reset-password", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    resetMailboxPasswordMock.mockReset();
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123" });
  });

  it("resets a mailbox password", async () => {
    resetMailboxPasswordMock.mockResolvedValue({
      id: "account-1",
      passwordUpdated: true,
    });

    const response = await POST(createResetPasswordRequest({ newPassword: "SecurePass2!" }), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: "account-1",
        passwordUpdated: true,
      },
    });
    expect(resetMailboxPasswordMock).toHaveBeenCalledWith({
      accountId: "account-1",
      newPassword: "SecurePass2!",
    });
  });

  it("returns 400 for invalid password payloads", async () => {
    const response = await POST(createResetPasswordRequest({ newPassword: "short" }), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Please provide a valid new password.",
    });
  });

  it("returns 404 when the mailbox is missing", async () => {
    resetMailboxPasswordMock.mockRejectedValue(
      Object.assign(new Error("Mailbox account not found."), {
        code: "MAILBOX_ACCOUNT_NOT_FOUND",
      })
    );

    const response = await POST(createResetPasswordRequest({ newPassword: "SecurePass2!" }), {
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

    const response = await POST(createResetPasswordRequest({ newPassword: "SecurePass2!" }), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Not authenticated. Please sign in again.",
    });
  });
});
