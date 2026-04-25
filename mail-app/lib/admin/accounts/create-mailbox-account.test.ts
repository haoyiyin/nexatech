import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  maybeSingleMock,
  createUserMock,
  deleteUserMock,
  insertSingleMock,
  welcomeInsertMock,
  eqMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  createUserMock: vi.fn(),
  deleteUserMock: vi.fn(),
  insertSingleMock: vi.fn(),
  welcomeInsertMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { createMailboxAccount } from "./create-mailbox-account";

describe("createMailboxAccount", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    createUserMock.mockReset();
    deleteUserMock.mockReset();
    insertSingleMock.mockReset();
    welcomeInsertMock.mockReset();
    eqMock.mockReset();

    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });

    welcomeInsertMock.mockResolvedValue({ error: null });

    createAdminClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "mailbox_accounts") {
          return {
            select: () => ({
              eq: eqMock,
            }),
            insert: () => ({
              select: () => ({
                single: insertSingleMock,
              }),
            }),
          };
        }

        if (table === "mail_messages") {
          return {
            insert: welcomeInsertMock,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
      auth: {
        admin: {
          createUser: createUserMock,
          deleteUser: deleteUserMock,
        },
      },
    });
  });

  it("signals duplicate email with a stable error code", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "existing-account" },
      error: null,
    });

    await expect(
      createMailboxAccount({
        emailPrefix: "student",
        password: "SecurePass1!",
      })
    ).rejects.toMatchObject({
      code: "MAILBOX_ACCOUNT_EXISTS",
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("normalizes email before duplicate lookup", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "existing-account" },
      error: null,
    });

    await expect(
      createMailboxAccount({
        emailPrefix: "  Student  ",
        password: "SecurePass1!",
      })
    ).rejects.toMatchObject({
      code: "MAILBOX_ACCOUNT_EXISTS",
    });

    expect(eqMock).toHaveBeenCalledWith("email_address", "student@nexatech.edu.kg");
  });

  it("deletes the auth user when mailbox row creation fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    createUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
      error: null,
    });
    insertSingleMock.mockResolvedValue({
      data: null,
      error: { message: "insert failed" },
    });
    deleteUserMock.mockResolvedValue({ error: null });

    await expect(
      createMailboxAccount({
        emailPrefix: "student",
        password: "SecurePass1!",
      })
    ).rejects.toThrow("Failed to create mailbox account.");

    expect(deleteUserMock).toHaveBeenCalledWith("user-123");
  });

  it("stops before inserting when auth user creation fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    createUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "weak password" },
    });

    await expect(
      createMailboxAccount({
        emailPrefix: "student",
        password: "SecurePass1!",
      })
    ).rejects.toThrow("Failed to create mailbox account.");

    expect(insertSingleMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("creates a mailbox account successfully", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    createUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
      error: null,
    });
    insertSingleMock.mockResolvedValue({
      data: {
        id: "mailbox-1",
        email_address: "student@nexatech.edu.kg",
        student_identifier: "S-001",
        role: "student",
        status: "active",
        created_at: "2026-04-20T00:00:00.000Z",
      },
      error: null,
    });

    await expect(
      createMailboxAccount({
        emailPrefix: "student",
        password: "SecurePass1!",
        studentIdentifier: "S-001",
      })
    ).resolves.toEqual({
      id: "mailbox-1",
      emailAddress: "student@nexatech.edu.kg",
      studentIdentifier: "S-001",
      role: "student",
      status: "active",
      createdAt: "2026-04-20T00:00:00.000Z",
    });

    expect(welcomeInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_user_id: "user-123",
        owner_email_address: "student@nexatech.edu.kg",
        from_address: "welcome@nexatech.edu.kg",
        to_address: "student@nexatech.edu.kg",
        subject: "Welcome to Nexatech University",
      })
    );
  });
});
