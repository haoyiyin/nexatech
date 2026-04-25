import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers?: HeadersInit
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function getClientIp(request: NextRequest) {
  const candidateIp = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-vercel-forwarded-for"),
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  return candidateIp?.split(",")[0]?.trim() || "unknown";
}

export function isInvalidOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin !== request.nextUrl.origin);
}
