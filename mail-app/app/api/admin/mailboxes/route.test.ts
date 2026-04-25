import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAdminSessionMock,
  listMailboxAccountsMock,
  createMailboxAccountMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  listMailboxAccountsMock: vi.fn(),
  createMailboxAccountMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/admin/accounts/list-mailbox-accounts", () => ({
  listMailboxAccounts: listMailboxAccountsMock,
}));

vi.mock("@/lib/admin/accounts/create-mailbox-account", () => ({
  createMailboxAccount: createMailboxAccountMock,
}));

import { GET, POST } from "./route";

function createMailboxRequest(method: "GET" | "POST", query = "", body?: unknown) {
  return new NextRequest(`https://www.nexatech.edu.kg/mail/api/admin/mailboxes${query}`, {
    method,
    headers:
      method === "POST"
        ? {
            "content-type": "application/json",
            origin: "https://www.nexatech.edu.kg",
            "cf-connecting-ip": "203.0.113.10",
          }
        : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("/api/admin/mailboxes", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    listMailboxAccountsMock.mockReset();
    createMailboxAccountMock.mockReset();
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123" });
  });

  it("returns paginated mailbox accounts", async () => {
    listMailboxAccountsMock.mockResolvedValue({
      mailboxes: [
        {
          id: "account-1",
          emailAddress: "student1@nexatech.edu.kg",
          studentIdentifier: "S-001",
          role: "student",
          status: "active",
          createdAt: "2026-04-20T00:00:00.000Z",
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });

    const response = await GET(createMailboxRequest("GET", "?page=1&q=student"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        mailboxes: [
          {
            id: "account-1",
            emailAddress: "student1@nexatech.edu.kg",
            studentIdentifier: "S-001",
            role: "student",
            status: "active",
            createdAt: "2026-04-20T00:00:00.000Z",
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      },
    });
    expect(listMailboxAccountsMock).toHaveBeenCalledWith({
      page: 1,
      query: "student",
    });
  });

  it("returns 401 for list requests without an admin session", async () => {
    requireAdminSessionMock.mockRejectedValue(new Error("NEXT_REDIRECT:/admin/login"));

    const response = await GET(createMailboxRequest("GET"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Not authenticated. Please sign in again.",
    });
  });

  it("creates a mailbox account", async () => {
    createMailboxAccountMock.mockResolvedValue({
      id: "account-2",
      emailAddress: "student2@nexatech.edu.kg",
      studentIdentifier: "S-002",
      role: "student",
      status: "active",
      createdAt: "2026-04-20T00:00:00.000Z",
    });

    const response = await POST(
      createMailboxRequest("POST", "", {
        emailPrefix: "student2",
        password: "SecurePass1!",
        studentIdentifier: "S-002",
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: "account-2",
        emailAddress: "student2@nexatech.edu.kg",
        studentIdentifier: "S-002",
        role: "student",
        status: "active",
        createdAt: "2026-04-20T00:00:00.000Z",
      },
    });
  });

  it("returns 400 for invalid mailbox creation payloads", async () => {
    const response = await POST(
      createMailboxRequest("POST", "", {
        emailPrefix: "invalid prefix",
        password: "short",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Please provide a valid email prefix and password.",
    });
    expect(createMailboxAccountMock).not.toHaveBeenCalled();
  });

  it("returns 403 for invalid creation origins", async () => {
    const response = await POST(
      new NextRequest("https://www.nexatech.edu.kg/mail/api/admin/mailboxes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example.com",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({
          emailPrefix: "student2",
          password: "SecurePass1!",
        }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid request origin.",
    });
  });

  it("returns 409 when mailbox creation hits a duplicate email", async () => {
    createMailboxAccountMock.mockRejectedValue(
      Object.assign(new Error("Mailbox account already exists."), {
        code: "MAILBOX_ACCOUNT_EXISTS",
      })
    );

    const response = await POST(
      createMailboxRequest("POST", "", {
        emailPrefix: "student2",
        password: "SecurePass1!",
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "A mailbox account with that email already exists.",
    });
  });
});
