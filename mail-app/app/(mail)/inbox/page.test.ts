import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSessionMock,
  createClientMock,
  accountSingleMock,
  countEqMock,
  messagesRangeMock,
  messagesOrderMock,
  messagesEqMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  createClientMock: vi.fn(),
  accountSingleMock: vi.fn(),
  countEqMock: vi.fn(),
  messagesRangeMock: vi.fn(),
  messagesOrderMock: vi.fn(),
  messagesEqMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/components/inbox-list", () => ({
  default: "inbox-list",
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import InboxPage from "./page";

function createSupabaseMock() {
  return {
    from(table: string) {
      if (table === "mailbox_accounts") {
        return {
          select() {
            return {
              eq() {
                return {
                  single: accountSingleMock,
                };
              },
            };
          },
        };
      }

      return {
        select(_fields: string, options?: { count?: "exact"; head?: boolean }) {
          if (options?.head) {
            return {
              eq: countEqMock,
            };
          }

          return {
            eq: messagesEqMock,
          };
        },
      };
    },
  };
}

function getInboxListElement(element: { props: { children: unknown } }) {
  const children = Array.isArray(element.props.children)
    ? element.props.children
    : [element.props.children];

  return children.find(
    (child): child is { type: string; props: Record<string, unknown> } =>
      typeof child === "object" && child !== null && "type" in child && child.type === "inbox-list"
  );
}

function getTextContent(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }

  if (typeof node === "object" && "props" in node) {
    return getTextContent(node.props?.children);
  }

  return "";
}

describe("InboxPage pagination", () => {
  it("redirects back to the website login modal when the user is not authenticated", async () => {
    requireSessionMock.mockImplementationOnce(() => {
      redirectMock("https://www.nexatech.edu.kg/?mail_login=1");
    });

    await expect(
      InboxPage({
        searchParams: Promise.resolve({ page: "1" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:https://www.nexatech.edu.kg/?mail_login=1");

    expect(requireSessionMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("https://www.nexatech.edu.kg/?mail_login=1");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    requireSessionMock.mockReset();
    createClientMock.mockReset();
    accountSingleMock.mockReset();
    countEqMock.mockReset();
    messagesRangeMock.mockReset();
    messagesOrderMock.mockReset();
    messagesEqMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });

    requireSessionMock.mockResolvedValue({ id: "user-123" });
    accountSingleMock.mockResolvedValue({
      data: { email_address: "student@nexatech.edu.kg" },
      error: null,
    });
    countEqMock.mockResolvedValue({ count: 45, error: null });
    messagesEqMock.mockReturnValue({
      order: messagesOrderMock,
    });
    messagesOrderMock.mockReturnValue({
      range: messagesRangeMock,
    });
    messagesRangeMock.mockResolvedValue({
      data: [
        {
          id: "message-1",
          from_address: "teacher@nexatech.edu.kg",
          subject: "Reminder",
          received_at: "2026-04-19T10:00:00.000Z",
          is_read: false,
        },
      ],
      error: null,
    });
    createClientMock.mockResolvedValue(createSupabaseMock());
  });

  it("requests the expected message range for page 2", async () => {
    const element = await InboxPage({
      searchParams: Promise.resolve({ page: "2" }),
    });

    const inboxListElement = getInboxListElement(element);

    expect(inboxListElement).toBeDefined();
    expect(messagesRangeMock).toHaveBeenCalledWith(20, 39);
    expect(inboxListElement?.props.currentPage).toBe(2);
    expect(inboxListElement?.props.hasPreviousPage).toBe(true);
    expect(inboxListElement?.props.hasNextPage).toBe(true);
  });

  it("falls back to page 1 for invalid page params", async () => {
    const element = await InboxPage({
      searchParams: Promise.resolve({ page: "abc" }),
    });

    const inboxListElement = getInboxListElement(element);

    expect(inboxListElement).toBeDefined();
    expect(messagesRangeMock).toHaveBeenCalledWith(0, 19);
    expect(inboxListElement?.props.currentPage).toBe(1);
    expect(inboxListElement?.props.hasPreviousPage).toBe(false);
  });

  it("clamps requests past the last page", async () => {
    countEqMock.mockResolvedValueOnce({ count: 21, error: null });

    const element = await InboxPage({
      searchParams: Promise.resolve({ page: "9" }),
    });

    const inboxListElement = getInboxListElement(element);

    expect(inboxListElement).toBeDefined();
    expect(messagesRangeMock).toHaveBeenCalledWith(20, 39);
    expect(inboxListElement?.props.currentPage).toBe(2);
    expect(inboxListElement?.props.hasNextPage).toBe(false);
  });

  it("renders an empty inbox state when no messages exist", async () => {
    countEqMock.mockResolvedValueOnce({ count: 0, error: null });
    messagesRangeMock.mockResolvedValueOnce({ data: [], error: null });

    const element = await InboxPage({
      searchParams: Promise.resolve({ page: "1" }),
    });

    const inboxListElement = getInboxListElement(element);

    expect(inboxListElement).toBeDefined();
    expect(messagesRangeMock).toHaveBeenCalledWith(0, 19);
    expect(inboxListElement?.props.messages).toEqual([]);
    expect(inboxListElement?.props.currentPage).toBe(1);
    expect(inboxListElement?.props.hasPreviousPage).toBe(false);
    expect(inboxListElement?.props.hasNextPage).toBe(false);
  });

  it("normalizes null message results into an empty array", async () => {
    messagesRangeMock.mockResolvedValueOnce({ data: null, error: null });

    const element = await InboxPage({
      searchParams: Promise.resolve({ page: "1" }),
    });

    const inboxListElement = getInboxListElement(element);

    expect(inboxListElement).toBeDefined();
    expect(inboxListElement?.props.messages).toEqual([]);
  });

  it("shows a loading fallback when the mailbox account lookup is empty", async () => {
    accountSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const element = await InboxPage({
      searchParams: Promise.resolve({ page: "1" }),
    });

    expect(getTextContent(element)).toContain("Loading...");
  });
});
