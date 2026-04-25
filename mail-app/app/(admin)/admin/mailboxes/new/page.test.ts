import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminSessionMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/components/admin/create-mailbox-form", () => ({
  default: "create-mailbox-form",
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import NewMailboxPage from "./page";

describe("NewMailboxPage", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("redirects unauthenticated users", async () => {
    requireAdminSessionMock.mockRejectedValue(new Error("NEXT_REDIRECT:/admin/login"));

    await expect(NewMailboxPage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("renders the create mailbox form", async () => {
    requireAdminSessionMock.mockResolvedValue({ id: "admin-123" });

    const element = await NewMailboxPage();

    expect(element.props.children[1].type).toBe("create-mailbox-form");
  });
});
