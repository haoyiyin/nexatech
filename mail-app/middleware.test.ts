import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getUserMock,
  createServerClientMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { middleware } from "./middleware";

function createRequest(pathname: string, headers?: Record<string, string>) {
  return new NextRequest(`https://www.nexatech.edu.kg${pathname}`, {
    headers: {
      host: "www.nexatech.edu.kg",
      ...headers,
    },
  });
}

describe("middleware", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    createServerClientMock.mockReset();

    createServerClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    });
  });

  it("redirects signed-out student requests back to the website login modal", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await middleware(createRequest("/mail/inbox"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.nexatech.edu.kg/?mail_login=1&redirect=%2Finbox"
    );
  });

  it("redirects signed-out admin requests to /mail/admin/login", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await middleware(createRequest("/mail/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.nexatech.edu.kg/mail/admin/login?redirect=%2Fadmin"
    );
  });

  it("redirects authenticated users away from /mail/login", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const response = await middleware(createRequest("/mail/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.nexatech.edu.kg/mail/inbox");
  });

  it("allows authenticated users to reach /mail/admin/login for server-side role checks", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const response = await middleware(createRequest("/mail/admin/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects non-canonical hosts to the canonical host", async () => {
    const response = await middleware(
      createRequest("/mail/login", {
        host: "nexatech.edu.kg",
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.nexatech.edu.kg/mail/login");
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
