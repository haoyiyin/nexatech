import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  maybeSingleMock,
  updateUserByIdMock,
  eqMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  updateUserByIdMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { resetMailboxPassword } from "./reset-mailbox-password";

describe("resetMailboxPassword", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    updateUserByIdMock.mockReset();
    eqMock.mockReset();

    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });

    createAdminClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "mailbox_accounts") {
          return {
            select: () => ({
              eq: eqMock,
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
      auth: {
        admin: {
          updateUserById: updateUserByIdMock,
        },
      },
    });
  });

  it("resets a mailbox password successfully", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "account-1",
        user_id: "user-1",
      },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ error: null });

    await expect(
      resetMailboxPassword({
        accountId: "account-1",
        newPassword: "SecurePass2!",
      })
    ).resolves.toEqual({
      id: "account-1",
      passwordUpdated: true,
    });

    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", {
      password: "SecurePass2!",
    });
  });

  it("throws a stable not-found code when the mailbox is missing", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      resetMailboxPassword({
        accountId: "account-1",
        newPassword: "SecurePass2!",
      })
    ).rejects.toMatchObject({
      code: "MAILBOX_ACCOUNT_NOT_FOUND",
    });
  });

  it("throws when mailbox lookup fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "lookup failed" },
    });

    await expect(
      resetMailboxPassword({
        accountId: "account-1",
        newPassword: "SecurePass2!",
      })
    ).rejects.toThrow("Failed to load mailbox account.");
  });

  it("throws when password update fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "account-1",
        user_id: "user-1",
      },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({
      error: { message: "update failed" },
    });

    await expect(
      resetMailboxPassword({
        accountId: "account-1",
        newPassword: "SecurePass2!",
      })
    ).rejects.toThrow("Failed to reset mailbox password.");
  });
});
