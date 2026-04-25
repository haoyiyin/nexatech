import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: "link",
}));

vi.mock("@/components/admin/account-status-action", () => ({
  default: "account-status-action",
}));

vi.mock("@/components/admin/reset-password-form", () => ({
  default: "reset-password-form",
}));

vi.mock("@/components/ui/button", () => ({
  Button: "button",
  buttonVariants: ({ variant }: { variant?: string }) => `button-${variant ?? "default"}`,
}));

vi.mock("@/components/ui/input", () => ({
  Input: "input",
}));

import AccountsTable from "./accounts-table";

const mailbox = {
  id: "account-1",
  emailAddress: "student1@nexatech.edu.kg",
  studentIdentifier: "S-001",
  role: "student",
  status: "active" as const,
  createdAt: "2026-04-20T00:00:00.000Z",
};

function getRootChildren(element: { props: { children: unknown } }) {
  return Array.isArray(element.props.children) ? element.props.children : [element.props.children];
}

function getFooterChildren(element: { props: { children: unknown } }) {
  const rootChildren = getRootChildren(element);
  const footer = rootChildren[2] as { props: { children: unknown } };

  return Array.isArray(footer.props.children) ? footer.props.children : [footer.props.children];
}

describe("AccountsTable", () => {
  it("renders non-interactive pagination controls at the list boundaries", () => {
    const element = AccountsTable({
      mailboxes: [mailbox],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
      query: "",
    });

    const footerChildren = getFooterChildren(element);

    expect(footerChildren[0].type).toBe("span");
    expect(footerChildren[2].type).toBe("span");
  });

  it("renders pagination links when adjacent pages are available", () => {
    const element = AccountsTable({
      mailboxes: [mailbox],
      pagination: {
        currentPage: 2,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: true,
      },
      query: "student",
    });

    const footerChildren = getFooterChildren(element);

    expect(footerChildren[0].type).toBe("link");
    expect(footerChildren[0].props.href).toBe("/admin/mailboxes?page=1&q=student");
    expect(footerChildren[2].type).toBe("link");
    expect(footerChildren[2].props.href).toBe("/admin/mailboxes?page=3&q=student");
  });

  it("hides the status action for the current admin account", () => {
    const element = AccountsTable({
      mailboxes: [mailbox],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
      query: "",
      currentAdminMailboxId: "account-1",
    });

    const rootChildren = getRootChildren(element);
    const tableWrapper = rootChildren[1] as { props: { children: unknown } };
    const table = tableWrapper.props.children as { props: { children: unknown } };
    const tbody = (table.props.children as Array<{ props: { children: unknown } }>)[1];
    const row = (tbody.props.children as Array<{ props: { children: unknown } }>)[0];
    const cells = row.props.children as Array<{ props: { children: unknown } }>;
    const actionsCell = cells[5];
    const actionsWrapper = actionsCell.props.children as { props: { children: unknown } };
    const actions = (actionsWrapper.props.children as Array<unknown>).filter(Boolean);

    expect(actions).toHaveLength(1);
    expect((actions[0] as { type: string }).type).toBe("reset-password-form");
  });
});
