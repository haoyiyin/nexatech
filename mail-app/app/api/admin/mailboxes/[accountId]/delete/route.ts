import type { NextRequest } from "next/server";
import { deleteMailboxAccount } from "@/lib/admin/accounts/delete-mailbox-account";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { isInvalidOriginRequest, jsonResponse } from "@/lib/auth/api-helpers";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  if (!request.headers.get("origin") || isInvalidOriginRequest(request)) {
    return jsonResponse(
      {
        success: false,
        error: "Invalid request origin.",
      },
      403
    );
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminSession>>;

  try {
    adminUser = await requireAdminSession();
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Not authenticated. Please sign in again.",
      },
      401
    );
  }

  const { accountId } = await context.params;

  if (adminUser.mailboxAccountId === accountId) {
    return jsonResponse(
      {
        success: false,
        error: "You cannot delete your own account.",
      },
      403
    );
  }

  try {
    const data = await deleteMailboxAccount({ accountId });

    return jsonResponse(
      {
        success: true,
        data,
      },
      200
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "MAILBOX_ACCOUNT_NOT_FOUND"
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Mailbox account not found.",
        },
        404
      );
    }

    return jsonResponse(
      {
        success: false,
        error: "Failed to delete mailbox account.",
      },
      500
    );
  }
}
