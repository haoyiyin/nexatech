import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSessionMock,
  createClientMock,
  messageSingleMock,
  redirectMock,
  messageIdEqMock,
  ownerEqMock,
} = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  createClientMock: vi.fn(),
  messageSingleMock: vi.fn(),
  redirectMock: vi.fn(),
  messageIdEqMock: vi.fn(),
  ownerEqMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/components/message-view", () => ({
  default: "message-view",
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import MessagePage from "./page";

describe("MessagePage page context", () => {
  it("redirects to /login when the user is not authenticated", async () => {
    requireSessionMock.mockImplementationOnce(() => {
      redirectMock("/login");
    });

    await expect(
      MessagePage({
        params: Promise.resolve({ messageId: "message-1" }),
        searchParams: Promise.resolve({ page: "1" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(requireSessionMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    requireSessionMock.mockReset();
    createClientMock.mockReset();
    messageSingleMock.mockReset();
    redirectMock.mockReset();
    messageIdEqMock.mockReset();
    ownerEqMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });

    requireSessionMock.mockResolvedValue({ id: "user-123" });
    messageSingleMock.mockResolvedValue({
      data: {
        id: "message-1",
        owner_user_id: "user-123",
        from_address: "teacher@nexatech.edu.kg",
        to_address: "student@nexatech.edu.kg",
        subject: "Reminder",
        text_body: "Remember the assignment.",
        html_body_sanitized: null,
        received_at: "2026-04-19T10:00:00.000Z",
        is_read: false,
      },
      error: null,
    });
    messageIdEqMock.mockReturnValue({
      eq: ownerEqMock,
    });
    ownerEqMock.mockReturnValue({
      single: messageSingleMock,
    });
    createClientMock.mockResolvedValue({
      from() {
        return {
          select() {
            return {
              eq: messageIdEqMock,
            };
          },
        };
      },
    });
  });

  it("passes the inbox page search param through to the message view", async () => {
    const element = await MessagePage({
      params: Promise.resolve({ messageId: "message-1" }),
      searchParams: Promise.resolve({ page: "3" }),
    });

    expect(messageIdEqMock).toHaveBeenCalledWith("id", "message-1");
    expect(ownerEqMock).toHaveBeenCalledWith("owner_user_id", "user-123");
    expect(element.props.page).toBe(3);
    expect(element.props.message.id).toBe("message-1");
  });

  it("normalizes invalid page params before passing them to the view", async () => {
    const element = await MessagePage({
      params: Promise.resolve({ messageId: "message-1" }),
      searchParams: Promise.resolve({ page: "abc" }),
    });

    expect(element.props.page).toBe(1);
  });

  it("leaves page undefined when no search params are provided", async () => {
    const element = await MessagePage({
      params: Promise.resolve({ messageId: "message-1" }),
    });

    expect(element.props.page).toBeUndefined();
  });

  it("redirects back to the inbox when the message is missing", async () => {
    messageSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      MessagePage({
        params: Promise.resolve({ messageId: "message-missing" }),
        searchParams: Promise.resolve({ page: "2" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/inbox");

    expect(redirectMock).toHaveBeenCalledWith("/inbox");
  });

  it("redirects back to the inbox when the message belongs to another user", async () => {
    messageSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      MessagePage({
        params: Promise.resolve({ messageId: "message-foreign" }),
        searchParams: Promise.resolve({ page: "2" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/inbox");

    expect(messageIdEqMock).toHaveBeenCalledWith("id", "message-foreign");
    expect(ownerEqMock).toHaveBeenCalledWith("owner_user_id", "user-123");
    expect(redirectMock).toHaveBeenCalledWith("/inbox");
  });

  it("throws when message lookup fails", async () => {
    messageSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "lookup failed" },
    });

    await expect(
      MessagePage({
        params: Promise.resolve({ messageId: "message-1" }),
        searchParams: Promise.resolve({ page: "1" }),
      })
    ).rejects.toThrow("Failed to load message.");
  });
});
