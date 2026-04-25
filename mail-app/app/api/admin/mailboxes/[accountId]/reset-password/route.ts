import type { NextRequest } from "next/server";
import { z } from "zod";
import { resetMailboxPassword } from "@/lib/admin/accounts/reset-mailbox-password";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { isInvalidOriginRequest, jsonResponse } from "@/lib/auth/api-helpers";

const resetMailboxPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

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
  const parsed = resetMailboxPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      {
        success: false,
        error: "Please provide a valid new password.",
      },
      400
    );
  }

  const { accountId } = await context.params;

  try {
    const data = await resetMailboxPassword({
      accountId,
      newPassword: parsed.data.newPassword,
    });

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
        error: "Failed to reset mailbox password.",
      },
      500
    );
  }
}
