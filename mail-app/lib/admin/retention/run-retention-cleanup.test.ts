import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  fromMock,
  deleteLtMock,
  deleteSelectMock,
  deleteLimitMock,
  updateEqMock,
  insertSelectSingleMock,
  insertSelectMock,
  insertMock,
  eventInsertMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  fromMock: vi.fn(),
  deleteLtMock: vi.fn(),
  deleteSelectMock: vi.fn(),
  deleteLimitMock: vi.fn(),
  updateEqMock: vi.fn(),
  insertSelectSingleMock: vi.fn(),
  insertSelectMock: vi.fn(),
  insertMock: vi.fn(),
  eventInsertMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { runRetentionCleanup } from "./run-retention-cleanup";

describe("runRetentionCleanup", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    fromMock.mockReset();
    deleteLtMock.mockReset();
    deleteSelectMock.mockReset();
    deleteLimitMock.mockReset();
    updateEqMock.mockReset();
    insertSelectSingleMock.mockReset();
    insertSelectMock.mockReset();
    insertMock.mockReset();
    eventInsertMock.mockReset();

    deleteLtMock.mockReturnValue({ select: deleteSelectMock });
    deleteSelectMock.mockReturnValue({ limit: deleteLimitMock });
    deleteLimitMock.mockResolvedValue({ data: [], error: null });
    updateEqMock.mockResolvedValue({ error: null });
    eventInsertMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({
      data: { id: "job-1" },
      error: null,
    });
    insertSelectMock.mockReturnValue({ single: insertSelectSingleMock });
    insertMock.mockReturnValue({ select: insertSelectMock });

    fromMock.mockImplementation((table: string) => {
      if (table === "mail_job_runs") {
        return {
          insert: insertMock,
          update: () => ({ eq: updateEqMock }),
          delete: () => ({ lt: deleteLtMock }),
        };
      }

      if (table === "mail_ingestion_events") {
        return {
          insert: eventInsertMock,
          delete: () => ({ lt: deleteLtMock }),
        };
      }

      if (table === "mail_ingestion_failures" || table === "mail_messages") {
        return {
          delete: () => ({ lt: deleteLtMock }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    createAdminClientMock.mockReturnValue({ from: fromMock });
  });

  it("returns cleanup summary counts for the requested retention window", async () => {
    deleteLimitMock
      .mockResolvedValueOnce({ data: [{ id: "m1" }, { id: "m2" }], error: null })
      .mockResolvedValueOnce({ data: [{ id: "e1" }], error: null })
      .mockResolvedValueOnce({ data: [{ id: "f1" }], error: null })
      .mockResolvedValueOnce({ data: [{ id: "j1" }], error: null });

    const result = await runRetentionCleanup({ retentionDays: 45 });

    expect(result).toEqual({
      deleted_messages_count: 2,
      deleted_events_count: 1,
      deleted_failures_count: 1,
      deleted_job_runs_count: 1,
    });
  });

  it("continues when job run persistence is unavailable", async () => {
    insertSelectSingleMock.mockRejectedValue(new Error("job run down"));

    await expect(runRetentionCleanup({ retentionDays: 30 })).resolves.toEqual({
      deleted_messages_count: 0,
      deleted_events_count: 0,
      deleted_failures_count: 0,
      deleted_job_runs_count: 0,
    });
  });

  it("treats missing optional reliability tables as empty cleanup targets", async () => {
    deleteLimitMock
      .mockResolvedValueOnce({ data: [{ id: "m1" }], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST205", message: "missing events table" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST205", message: "missing failures table" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST205", message: "missing job runs table" },
      });

    await expect(runRetentionCleanup({ retentionDays: 30 })).resolves.toEqual({
      deleted_messages_count: 1,
      deleted_events_count: 0,
      deleted_failures_count: 0,
      deleted_job_runs_count: 0,
    });
  });
});
