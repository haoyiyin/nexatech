// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";

const refreshMock = vi.fn();
const confirmMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

import ManualCleanupForm from "./manual-cleanup-form";

describe("ManualCleanupForm", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const fetchMock = vi.fn();

  beforeEach(() => {
    // @ts-expect-error react act test flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock.mockReset();
    refreshMock.mockReset();
    confirmMock.mockReset();
    confirmMock.mockReturnValue(true);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("submits cleanup days and shows success summary", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          deleted_messages_count: 2,
          deleted_events_count: 1,
          deleted_failures_count: 0,
          deleted_job_runs_count: 0,
          deleted_rate_limits_count: 0,
        },
      }),
    });

    await act(async () => {
      root.render(<ManualCleanupForm />);
    });

    const input = container.querySelector('input[type="number"]');
    const form = container.querySelector("form");

    await act(async () => {
      input.value = "45";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(confirmMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/mail/api/admin/retention/cleanup", expect.objectContaining({
      method: "POST",
    }));
    expect(container.textContent).toContain("Deleted 2 messages older than");
    expect(container.textContent).toContain("Also removed 1 events, 0 failures, and 0 job records.");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows server error feedback when cleanup fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "Cleanup failed." }),
    });

    await act(async () => {
      root.render(<ManualCleanupForm />);
    });

    const form = container.querySelector("form");

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Cleanup failed.");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
