import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  signInWithPasswordMock,
  signOutMock,
  maybeSingleMock,
  fromMock,
  selectMock,
  eqMock,
  getLoginRateLimitEntriesMock,
  incrementLoginRateLimitMock,
  clearLoginRateLimitMock,
} = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  getLoginRateLimitEntriesMock: vi.fn(),
  incrementLoginRateLimitMock: vi.fn(),
  clearLoginRateLimitMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
    },
    from: fromMock,
  })),
}));

vi.mock("@/lib/auth/login-rate-limit-store", () => ({
  getLoginRateLimitEntries: getLoginRateLimitEntriesMock,
  incrementLoginRateLimit: incrementLoginRateLimitMock,
  clearLoginRateLimit: clearLoginRateLimitMock,
}));

fromMock.mockReturnValue({
  select: selectMock,
});

selectMock.mockReturnValue({
  eq: eqMock,
});

eqMock.mockReturnValue({
  maybeSingle: maybeSingleMock,
});

import { POST } from "./route";

function createAdminLoginRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
) {
  return new NextRequest("https://www.nexatech.edu.kg/mail/api/admin/auth/login", {
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

describe("POST /api/admin/auth/login", () => {
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    maybeSingleMock.mockReset();
    fromMock.mockClear();
    selectMock.mockClear();
    eqMock.mockClear();
    getLoginRateLimitEntriesMock.mockReset();
    incrementLoginRateLimitMock.mockReset();
    clearLoginRateLimitMock.mockReset();

    getLoginRateLimitEntriesMock.mockResolvedValue([]);
    incrementLoginRateLimitMock.mockResolvedValue(undefined);
    clearLoginRateLimitMock.mockResolvedValue(undefined);
    signOutMock.mockResolvedValue({ error: null });
  });

  it("returns 400 for invalid bodies", async () => {
    const response = await POST(
      createAdminLoginRequest({
        email: "not-an-email",
        password: "",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Please enter a valid email address and password.",
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 403 for invalid origins", async () => {
    const response = await POST(
      createAdminLoginRequest(
        {
          email: "admin@nexatech.edu.kg",
          password: "correct-password",
        },
        { origin: "https://evil.example.com" }
      )
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid request origin.",
    });
  });

  it("returns 401 for invalid credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(
      createAdminLoginRequest({
        email: "admin@nexatech.edu.kg",
        password: "wrong-password",
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid email or password. Please try again.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(incrementLoginRateLimitMock).toHaveBeenNthCalledWith(
      1,
      "admin-login:email:admin@nexatech.edu.kg"
    );
    expect(incrementLoginRateLimitMock).toHaveBeenNthCalledWith(2, "admin-login:ip:203.0.113.10");
  });

  it("allows active admin accounts to log in", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: { id: "admin-123" },
        session: { access_token: "token" },
      },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "admin", status: "active" },
      error: null,
    });

    const response = await POST(
      createAdminLoginRequest({
        email: "admin@nexatech.edu.kg",
        password: "correct-password",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      redirectTo: "/admin",
    });
    expect(fromMock).toHaveBeenCalledWith("mailbox_accounts");
    expect(selectMock).toHaveBeenCalledWith("role, status");
    expect(eqMock).toHaveBeenCalledWith("user_id", "admin-123");
    expect(clearLoginRateLimitMock).toHaveBeenCalledTimes(2);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("returns the generic 401 error for authenticated non-admin users", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: { id: "student-123" },
        session: { access_token: "token" },
      },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "student", status: "active" },
      error: null,
    });

    const response = await POST(
      createAdminLoginRequest({
        email: "student@nexatech.edu.kg",
        password: "correct-password",
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid email or password. Please try again.",
    });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(incrementLoginRateLimitMock).toHaveBeenCalledTimes(2);
  });

  it("returns the generic 401 error for suspended admin accounts", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: { id: "admin-suspended" },
        session: { access_token: "token" },
      },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "admin", status: "suspended" },
      error: null,
    });

    const response = await POST(
      createAdminLoginRequest({
        email: "admin@nexatech.edu.kg",
        password: "correct-password",
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid email or password. Please try again.",
    });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
  });

  it("returns 500 when the admin account lookup fails", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: { id: "admin-error" },
        session: { access_token: "token" },
      },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "lookup failed" },
    });

    const response = await POST(
      createAdminLoginRequest({
        email: "admin@nexatech.edu.kg",
        password: "correct-password",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Authentication is temporarily unavailable.",
    });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
  });

  it("returns 429 when admin login attempts are rate limited", async () => {
    getLoginRateLimitEntriesMock.mockResolvedValue([
      {
        key: "admin-login:email:admin@nexatech.edu.kg",
        attempts: 5,
        reset_at: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);

    const response = await POST(
      createAdminLoginRequest({
        email: "admin@nexatech.edu.kg",
        password: "correct-password",
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("normalizes uppercase emails before authenticating", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: { id: "admin-upper" },
        session: { access_token: "token" },
      },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: { role: "admin", status: "active" },
      error: null,
    });

    const response = await POST(
      createAdminLoginRequest({
        email: "ADMIN@NEXATECH.EDU.KG",
        password: "correct-password",
      })
    );

    expect(response.status).toBe(200);
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "admin@nexatech.edu.kg",
      password: "correct-password",
    });
  });

  it("returns 403 when origin is missing", async () => {
    const response = await POST(
      createAdminLoginRequest(
        {
          email: "admin@nexatech.edu.kg",
          password: "correct-password",
        },
        { origin: "" }
      )
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid request origin.",
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 500 when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await POST(
      createAdminLoginRequest({
        email: "admin@nexatech.edu.kg",
        password: "correct-password",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Authentication is temporarily unavailable.",
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });
});
