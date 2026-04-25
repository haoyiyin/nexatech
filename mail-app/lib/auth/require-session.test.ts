import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserMock,
  createClientMock,
  redirectMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { requireSession } from "./require-session";

describe("requireSession", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    createClientMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    });
  });

  it("redirects signed-out users back to the website login modal", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(requireSession()).rejects.toThrow(
      "NEXT_REDIRECT:https://www.nexatech.edu.kg/?mail_login=1"
    );
  });

  it("returns the authenticated user", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "student@nexatech.edu.kg" } },
      error: null,
    });

    await expect(requireSession()).resolves.toEqual({
      id: "user-123",
      email: "student@nexatech.edu.kg",
    });
  });
});
