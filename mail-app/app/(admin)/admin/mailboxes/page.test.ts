import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminSessionMock,
  listMailboxAccountsMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  listMailboxAccountsMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/admin/accounts/list-mailbox-accounts", () => ({
  listMailboxAccounts: listMailboxAccountsMock,
}));

vi.mock("@/components/admin/accounts-table", () => ({
  default: "accounts-table",
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import AdminMailboxesPage from "./page";

describe("AdminMailboxesPage", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    listMailboxAccountsMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("redirects unauthenticated users", async () => {
    requireAdminSessionMock.mockRejectedValue(new Error("NEXT_REDIRECT:/admin/login"));

    await expect(AdminMailboxesPage({ searchParams: Promise.resolve({ page: "1" }) })).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login"
    );
  });

  it("renders paginated mailbox data", async () => {
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123", mailboxAccountId: "admin-account-1" });
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
      query: "student",
    });

    const element = await AdminMailboxesPage({
      searchParams: Promise.resolve({ page: "1", q: "student" }),
    });

    expect(element.props.children[1].type).toBe("accounts-table");
    expect(element.props.children[1].props.mailboxes).toEqual([
      {
        id: "account-1",
        emailAddress: "student1@nexatech.edu.kg",
        studentIdentifier: "S-001",
        role: "student",
        status: "active",
        createdAt: "2026-04-20T00:00:00.000Z",
      },
    ]);
    expect(element.props.children[1].props.query).toBe("student");
    expect(element.props.children[1].props.currentAdminMailboxId).toBe("admin-account-1");
  });
});
