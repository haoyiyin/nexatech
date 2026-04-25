// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

import AccountStatusAction from "./account-status-action";

describe("AccountStatusAction", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const fetchMock = vi.fn();
  const reloadMock = vi.fn();

  beforeEach(() => {
    // @ts-expect-error react act test flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock.mockReset();
    reloadMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", {
      value: {
        reload: reloadMock,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows an error message when the status update fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to update mailbox status." }),
    });

    await act(async () => {
      root.render(<AccountStatusAction accountId="account-1" status="active" />);
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Failed to update mailbox status.");
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("shows a fallback error message when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("Network failure"));

    await act(async () => {
      root.render(<AccountStatusAction accountId="account-1" status="suspended" />);
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Failed to update mailbox status.");
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
