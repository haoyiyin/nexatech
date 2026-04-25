import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  maybeSingleMock,
  deleteUserMock,
  mailMessagesDeleteEqMock,
  eqMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  deleteUserMock: vi.fn(),
  mailMessagesDeleteEqMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { deleteMailboxAccount } from "./delete-mailbox-account";

describe("deleteMailboxAccount", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    deleteUserMock.mockReset();
    mailMessagesDeleteEqMock.mockReset();
    eqMock.mockReset();

    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });

    mailMessagesDeleteEqMock.mockResolvedValue({ error: null });

    createAdminClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "mailbox_accounts") {
          return {
            select: () => ({
              eq: eqMock,
            }),
          };
        }

        if (table === "mail_messages") {
          return {
            delete: () => ({
              eq: mailMessagesDeleteEqMock,
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
      auth: {
        admin: {
          deleteUser: deleteUserMock,
        },
      },
    });
  });

  it("deletes the auth user for an existing mailbox account", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "account-1", user_id: "user-123" },
      error: null,
    });
    deleteUserMock.mockResolvedValue({ error: null });

    await expect(deleteMailboxAccount({ accountId: "account-1" })).resolves.toEqual({
      id: "account-1",
      deleted: true,
    });
    expect(mailMessagesDeleteEqMock).toHaveBeenCalledWith("owner_user_id", "user-123");
    expect(deleteUserMock).toHaveBeenCalledWith("user-123");
  });

  it("returns a stable not-found code when the mailbox is missing", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(deleteMailboxAccount({ accountId: "account-1" })).rejects.toMatchObject({
      code: "MAILBOX_ACCOUNT_NOT_FOUND",
    });
  });
});
