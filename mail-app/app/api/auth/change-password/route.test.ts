import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  createClientMock,
  createSupabaseClientMock,
  getUserMock,
  signOutMock,
  verifySignInWithPasswordMock,
  verifySignOutMock,
  updateUserByIdMock,
  getLoginRateLimitEntriesMock,
  incrementLoginRateLimitMock,
  clearLoginRateLimitMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createSupabaseClientMock: vi.fn(),
  getUserMock: vi.fn(),
  signOutMock: vi.fn(),
  verifySignInWithPasswordMock: vi.fn(),
  verifySignOutMock: vi.fn(),
  updateUserByIdMock: vi.fn(),
  getLoginRateLimitEntriesMock: vi.fn(),
  incrementLoginRateLimitMock: vi.fn(),
  clearLoginRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        updateUserById: updateUserByIdMock,
      },
    },
  })),
}));

vi.mock("@/lib/auth/login-rate-limit-store", () => ({
  getLoginRateLimitEntries: getLoginRateLimitEntriesMock,
  incrementLoginRateLimit: incrementLoginRateLimitMock,
  clearLoginRateLimit: clearLoginRateLimitMock,
}));

import { POST } from "./route";

function createChangePasswordRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest("https://www.nexatech.edu.kg/mail/api/auth/change-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.nexatech.edu.kg",
      "cf-connecting-ip": "203.0.113.10",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    createClientMock.mockReset();
    createSupabaseClientMock.mockReset();
    getUserMock.mockReset();
    signOutMock.mockReset();
    verifySignInWithPasswordMock.mockReset();
    verifySignOutMock.mockReset();
    updateUserByIdMock.mockReset();
    getLoginRateLimitEntriesMock.mockReset();
    incrementLoginRateLimitMock.mockReset();
    clearLoginRateLimitMock.mockReset();

    getLoginRateLimitEntriesMock.mockResolvedValue([]);
    incrementLoginRateLimitMock.mockResolvedValue(undefined);
    clearLoginRateLimitMock.mockResolvedValue(undefined);
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "student@nexatech.edu.kg",
        },
      },
      error: null,
    });
    signOutMock.mockResolvedValue({ error: null });
    verifySignInWithPasswordMock.mockResolvedValue({
      data: {
        session: { access_token: "token" },
      },
      error: null,
    });
    verifySignOutMock.mockResolvedValue({ error: null });
    updateUserByIdMock.mockResolvedValue({ error: null });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
        signOut: signOutMock,
      },
    });

    createSupabaseClientMock.mockReturnValue({
      auth: {
        signInWithPassword: verifySignInWithPasswordMock,
        signOut: verifySignOutMock,
      },
    });
  });

  it("returns 403 for invalid request origins", async () => {
    const response = await POST(
      createChangePasswordRequest(
        {
          currentPassword: "OldPassword1!",
          newPassword: "NewPassword1!",
          confirmPassword: "NewPassword1!",
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

  it("returns 400 for invalid request bodies", async () => {
    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "",
        newPassword: "short",
        confirmPassword: "different",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "String must contain at least 1 character(s)",
    });
  });

  it("returns 500 when Supabase auth env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Authentication is temporarily unavailable.",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Not authenticated. Please sign in again.",
    });
    expect(verifySignInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 401 when loading the authenticated user fails", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "session lookup failed" },
    });

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Not authenticated. Please sign in again.",
    });
    expect(verifySignInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 429 when password change is rate limited", async () => {
    getLoginRateLimitEntriesMock.mockResolvedValue([
      {
        key: "password-change:email:student@nexatech.edu.kg",
        attempts: 5,
        reset_at: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(verifySignInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 429 when IP-based password change attempts are rate limited", async () => {
    getLoginRateLimitEntriesMock.mockResolvedValue([
      {
        key: "password-change:ip:203.0.113.10",
        attempts: 20,
        reset_at: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(verifySignInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("fails open when rate-limit storage is unavailable", async () => {
    getLoginRateLimitEntriesMock.mockRejectedValue(new Error("store down"));

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(verifySignInWithPasswordMock).toHaveBeenCalled();
    expect(updateUserByIdMock).toHaveBeenCalledWith("user-123", {
      password: "NewPassword1!",
    });
  });

  it("returns 401 when the current password is incorrect", async () => {
    verifySignInWithPasswordMock.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "WrongPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Current password is incorrect.",
    });
    expect(incrementLoginRateLimitMock).toHaveBeenCalledTimes(2);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the new password matches the current password", async () => {
    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "SamePassword1!",
        newPassword: "SamePassword1!",
        confirmPassword: "SamePassword1!",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "New password must be different from your current password.",
    });
    expect(verifySignInWithPasswordMock).toHaveBeenCalled();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("returns 500 when password verification throws", async () => {
    verifySignInWithPasswordMock.mockRejectedValue(new Error("network error"));

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Authentication is temporarily unavailable.",
    });
    expect(incrementLoginRateLimitMock).toHaveBeenCalledTimes(2);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the admin password update fails", async () => {
    updateUserByIdMock.mockResolvedValue({
      error: { message: "update failed" },
    });

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Failed to update password. Please try again.",
    });
    expect(incrementLoginRateLimitMock).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when global sign-out fails after a successful password update", async () => {
    signOutMock.mockResolvedValue({ error: { message: "sign out failed" } });

    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Password updated, but we could not end your sessions. Please sign out manually.",
    });
  });

  it("updates the password and signs the user out globally", async () => {
    const response = await POST(
      createChangePasswordRequest({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(verifySignInWithPasswordMock).toHaveBeenCalledWith({
      email: "student@nexatech.edu.kg",
      password: "OldPassword1!",
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("user-123", {
      password: "NewPassword1!",
    });
    expect(verifySignOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "global" });
    expect(clearLoginRateLimitMock).toHaveBeenCalledTimes(2);
  });
});
