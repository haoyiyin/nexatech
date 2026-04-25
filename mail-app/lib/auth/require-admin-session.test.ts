import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserMock,
  createClientMock,
  fromMock,
  selectMock,
  eqMock,
  maybeSingleMock,
  redirectMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { requireAdminSession } from "./require-admin-session";

describe("requireAdminSession", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    createClientMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    redirectMock.mockReset();

    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
      from: fromMock,
    });

    fromMock.mockReturnValue({
      select: selectMock,
    });

    selectMock.mockReturnValue({
      eq: eqMock,
    });

    eqMock.mockReturnValue({
      maybeSingle: maybeSingleMock,
    });
  });

  it("redirects to /admin/login when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(requireAdminSession()).rejects.toThrow("NEXT_REDIRECT:/admin/login");

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("redirects to /admin/login when the mailbox account row is missing", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(requireAdminSession()).rejects.toThrow("NEXT_REDIRECT:/admin/login");

    expect(fromMock).toHaveBeenCalledWith("mailbox_accounts");
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("redirects to /admin/login when the user is not an admin", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-456" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "student", status: "active" },
      error: null,
    });

    await expect(requireAdminSession()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("redirects to /admin/login when the admin account is suspended", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-789" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "admin", status: "suspended" },
      error: null,
    });

    await expect(requireAdminSession()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("returns the authenticated user for active admin accounts", async () => {
    const user = { id: "admin-123", email: "admin@nexatech.edu.kg" };

    getUserMock.mockResolvedValue({
      data: { user },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "admin", status: "active" },
      error: null,
    });

    await expect(requireAdminSession()).resolves.toEqual(user);
  });

  it("throws when the admin account lookup fails", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-lookup-error" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: new Error("lookup failed"),
    });

    await expect(requireAdminSession()).rejects.toThrow("Failed to verify administrator access.");
  });
});
