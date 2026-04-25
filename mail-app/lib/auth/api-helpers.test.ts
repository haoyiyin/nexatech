import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp, isInvalidOriginRequest, jsonResponse } from "./api-helpers";

describe("api-helpers", () => {
  it("adds no-store cache headers to JSON responses", async () => {
    const response = jsonResponse({ success: true }, 200, {
      "X-Test": "1",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Test")).toBe("1");
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("prefers Cloudflare client IP headers", () => {
    const request = new NextRequest("https://www.nexatech.edu.kg/mail/login", {
      headers: {
        "cf-connecting-ip": "203.0.113.5",
        "x-vercel-forwarded-for": "198.51.100.20",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("normalizes proxy IP chains and falls back to unknown", () => {
    const forwardedRequest = new NextRequest("https://www.nexatech.edu.kg/mail/login", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.20, 198.51.100.21",
      },
    });
    const noIpRequest = new NextRequest("https://www.nexatech.edu.kg/mail/login");

    expect(getClientIp(forwardedRequest)).toBe("198.51.100.20");
    expect(getClientIp(noIpRequest)).toBe("unknown");
  });

  it("rejects mismatched origins and allows same-origin or missing origin", () => {
    const invalidOriginRequest = new NextRequest("https://www.nexatech.edu.kg/mail/login", {
      headers: {
        origin: "https://evil.example.com",
      },
    });
    const validOriginRequest = new NextRequest("https://www.nexatech.edu.kg/mail/login", {
      headers: {
        origin: "https://www.nexatech.edu.kg",
      },
    });
    const noOriginRequest = new NextRequest("https://www.nexatech.edu.kg/mail/login");

    expect(isInvalidOriginRequest(invalidOriginRequest)).toBe(true);
    expect(isInvalidOriginRequest(validOriginRequest)).toBe(false);
    expect(isInvalidOriginRequest(noOriginRequest)).toBe(false);
  });
});
