import type { NextRequest } from "next/server";
import { z } from "zod";
import { createMailboxAccount } from "@/lib/admin/accounts/create-mailbox-account";
import { listMailboxAccounts } from "@/lib/admin/accounts/list-mailbox-accounts";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { isInvalidOriginRequest, jsonResponse } from "@/lib/auth/api-helpers";
import { parsePageParam } from "@/lib/pagination";

const createMailboxSchema = z.object({
  emailPrefix: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
  studentIdentifier: z.string().trim().max(128).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Not authenticated. Please sign in again.",
      },
      401
    );
  }

  try {
    const pageParam = request.nextUrl.searchParams.get("page") ?? undefined;
    const page = parsePageParam(pageParam);
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const data = await listMailboxAccounts({
      page,
      query,
    });

    return jsonResponse(
      {
        success: true,
        data,
      },
      200
    );
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Failed to load mailbox accounts.",
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || isInvalidOriginRequest(request)) {
    return jsonResponse(
      {
        success: false,
        error: "Invalid request origin.",
      },
      403
    );
  }

  try {
    await requireAdminSession();
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Not authenticated. Please sign in again.",
      },
      401
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createMailboxSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      {
        success: false,
        error: "Please provide a valid email prefix and password.",
      },
      400
    );
  }

  try {
    const mailboxAccount = await createMailboxAccount(parsed.data);

    return jsonResponse(
      {
        success: true,
        data: mailboxAccount,
      },
      201
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "MAILBOX_ACCOUNT_EXISTS"
    ) {
      return jsonResponse(
        {
          success: false,
          error: "A mailbox account with that email already exists.",
        },
        409
      );
    }

    return jsonResponse(
      {
        success: false,
        error: "Failed to create mailbox account.",
      },
      500
    );
  }
}
