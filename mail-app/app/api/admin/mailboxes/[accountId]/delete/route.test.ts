import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAdminSessionMock,
  deleteMailboxAccountMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  deleteMailboxAccountMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/admin/accounts/delete-mailbox-account", () => ({
  deleteMailboxAccount: deleteMailboxAccountMock,
}));

import { POST } from "./route";

function createDeleteRequest(headers?: Record<string, string>) {
  return new NextRequest(
    "https://www.nexatech.edu.kg/mail/api/admin/mailboxes/account-1/delete",
    {
      method: "POST",
      headers: {
        origin: "https://www.nexatech.edu.kg",
        ...headers,
      },
    }
  );
}

describe("POST /api/admin/mailboxes/[accountId]/delete", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    deleteMailboxAccountMock.mockReset();
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123", mailboxAccountId: "admin-account-1" });
  });

  it("deletes a mailbox account", async () => {
    deleteMailboxAccountMock.mockResolvedValue({ id: "account-1", deleted: true });

    const response = await POST(createDeleteRequest(), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: "account-1", deleted: true },
    });
  });

  it("returns 403 when admin tries to delete their own account", async () => {
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123", mailboxAccountId: "account-1" });

    const response = await POST(createDeleteRequest(), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "You cannot delete your own account.",
    });
  });

  it("returns 404 when the mailbox account is missing", async () => {
    deleteMailboxAccountMock.mockRejectedValue(
      Object.assign(new Error("Mailbox account not found."), {
        code: "MAILBOX_ACCOUNT_NOT_FOUND",
      })
    );

    const response = await POST(createDeleteRequest(), {
      params: Promise.resolve({ accountId: "account-2" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Mailbox account not found.",
    });
  });

  it("returns 401 when admin session is invalid", async () => {
    requireAdminSessionMock.mockRejectedValue(new Error("Session expired"));

    const response = await POST(createDeleteRequest(), {
      params: Promise.resolve({ accountId: "account-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Not authenticated. Please sign in again.",
    });
  });
});
