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

vi.mock("@/components/admin-login-form", () => ({
  default: "admin-login-form",
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import AdminLoginPage from "./page";

describe("AdminLoginPage", () => {
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

    eqMock.mockReturnValue({
      maybeSingle: maybeSingleMock,
    });

    selectMock.mockReturnValue({
      eq: eqMock,
    });

    fromMock.mockReturnValue({
      select: selectMock,
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
      from: fromMock,
    });
  });

  it("renders the admin login form for signed-out users", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const element = await AdminLoginPage();

    expect(element.type).toBe("admin-login-form");
  });

  it("renders the admin login form for authenticated non-admin users", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "student-123" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "student", status: "active" },
      error: null,
    });

    const element = await AdminLoginPage();

    expect(element.type).toBe("admin-login-form");
  });

  it("redirects active admins to /admin", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-123" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "admin", status: "active" },
      error: null,
    });

    await expect(AdminLoginPage()).rejects.toThrow("NEXT_REDIRECT:/admin");
  });
});
