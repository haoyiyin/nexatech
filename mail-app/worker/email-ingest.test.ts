import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { htmlToPlainText } from "../lib/mail/sanitize-message";
import {
  CLEANUP_RETENTION_CRON,
  REPLAY_FAILURES_CRON,
  handleEmail,
  handleScheduled,
} from "./email-ingest";
import { parseEmail } from "./email-parse";

const TEST_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_KEY: "service-role-key",
  MAIL_DOMAIN: "nexatech.edu.kg",
};

type MockMessage = ForwardableEmailMessage & {
  from: string;
  to: string;
  raw: ReadableStream<Uint8Array>;
  setReject: ReturnType<typeof vi.fn>;
};

type FetchQueues = {
  mailboxAccounts?: Response[];
  mailMessagesPost?: Response[];
  mailMessagesDelete?: Response[];
  ingestionEventsPost?: Response[];
  ingestionEventsDelete?: Response[];
  ingestionFailuresGet?: Response[];
  ingestionFailuresPost?: Response[];
  ingestionFailuresPatch?: Response[];
  ingestionFailuresDelete?: Response[];
  jobRunsPost?: Response[];
  jobRunsPatch?: Response[];
  jobRunsDelete?: Response[];
};

function createMockMessage({
  raw,
  from = "sender@gmail.com",
  to = "student001@nexatech.edu.kg",
}: {
  raw: string;
  from?: string;
  to?: string;
}): MockMessage {
  const bytes = new TextEncoder().encode(raw);

  return {
    from,
    to,
    raw: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    setReject: vi.fn(),
  } as MockMessage;
}

function createScheduledController(cron: string): ScheduledController {
  return {
    cron,
    scheduledTime: Date.now(),
    type: "scheduled",
  } as ScheduledController;
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}

function emptyResponse(status = 201, statusText = "Created"): Response {
  return new Response(null, { status, statusText });
}

function shiftResponse(queue: Response[] | undefined, fallback: () => Response): Response {
  return queue && queue.length > 0 ? queue.shift()! : fallback();
}

function createFetchMock(queues: FetchQueues = {}) {
  const mailboxAccounts = [...(queues.mailboxAccounts ?? [])];
  const mailMessagesPost = [...(queues.mailMessagesPost ?? [])];
  const mailMessagesDelete = [...(queues.mailMessagesDelete ?? [])];
  const ingestionEventsPost = [...(queues.ingestionEventsPost ?? [])];
  const ingestionEventsDelete = [...(queues.ingestionEventsDelete ?? [])];
  const ingestionFailuresGet = [...(queues.ingestionFailuresGet ?? [])];
  const ingestionFailuresPost = [...(queues.ingestionFailuresPost ?? [])];
  const ingestionFailuresPatch = [...(queues.ingestionFailuresPatch ?? [])];
  const ingestionFailuresDelete = [...(queues.ingestionFailuresDelete ?? [])];
  const jobRunsPost = [...(queues.jobRunsPost ?? [])];
  const jobRunsPatch = [...(queues.jobRunsPatch ?? [])];
  const jobRunsDelete = [...(queues.jobRunsDelete ?? [])];

  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/rest/v1/mailbox_accounts")) {
      return shiftResponse(mailboxAccounts, () =>
        jsonResponse([{ user_id: "user-123", status: "active" }])
      );
    }

    if (url.includes("/rest/v1/mail_messages") && method === "DELETE") {
      return shiftResponse(mailMessagesDelete, () => jsonResponse([]));
    }

    if (url.includes("/rest/v1/mail_messages")) {
      return shiftResponse(mailMessagesPost, () => jsonResponse([{ id: "message-1" }], { status: 201 }));
    }

    if (url.includes("/rest/v1/mail_ingestion_events") && method === "DELETE") {
      return shiftResponse(ingestionEventsDelete, () => jsonResponse([]));
    }

    if (url.includes("/rest/v1/mail_ingestion_events")) {
      return shiftResponse(ingestionEventsPost, () => emptyResponse());
    }

    if (url.includes("/rest/v1/mail_ingestion_failures") && method === "GET") {
      return shiftResponse(ingestionFailuresGet, () => jsonResponse([]));
    }

    if (url.includes("/rest/v1/mail_ingestion_failures") && method === "DELETE") {
      return shiftResponse(ingestionFailuresDelete, () => jsonResponse([]));
    }

    if (url.includes("/rest/v1/mail_ingestion_failures") && method === "POST") {
      return shiftResponse(ingestionFailuresPost, () => emptyResponse());
    }

    if (url.includes("/rest/v1/mail_ingestion_failures") && method === "PATCH") {
      return shiftResponse(ingestionFailuresPatch, () => emptyResponse(204, "No Content"));
    }

    if (url.includes("/rest/v1/mail_job_runs") && method === "POST") {
      return shiftResponse(jobRunsPost, () => jsonResponse([{ id: "job-run-1" }], { status: 201 }));
    }

    if (url.includes("/rest/v1/mail_job_runs") && method === "DELETE") {
      return shiftResponse(jobRunsDelete, () => jsonResponse([]));
    }

    if (url.includes("/rest/v1/mail_job_runs") && method === "PATCH") {
      return shiftResponse(jobRunsPatch, () => emptyResponse(204, "No Content"));
    }

    throw new Error(`Unexpected fetch request: ${method} ${url}`);
  });
}

function getRequests(fetchMock: ReturnType<typeof vi.fn>, path: string, method?: string) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const requestMethod = (init?.method ?? "GET").toUpperCase();
    return String(input).includes(path) && (!method || requestMethod === method.toUpperCase());
  });
}

function getLastRequest(fetchMock: ReturnType<typeof vi.fn>, path: string, method?: string) {
  const requests = getRequests(fetchMock, path, method);
  const request = requests.at(-1);

  if (!request) {
    throw new Error(`No request found for ${method ?? "ANY"} ${path}`);
  }

  return request;
}

function getLastRequestJson<T>(fetchMock: ReturnType<typeof vi.fn>, path: string, method?: string): T {
  const [, init] = getLastRequest(fetchMock, path, method);
  return JSON.parse(String(init?.body)) as T;
}

function getLastRequestHeader(fetchMock: ReturnType<typeof vi.fn>, path: string, headerName: string) {
  const [, init] = getLastRequest(fetchMock, path);
  const headers = new Headers(init?.headers);
  return headers.get(headerName);
}

describe("email-ingest worker", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses basic plain text messages", async () => {
    const parsed = await parseEmail(
      [
        'From: Gmail Sender <sender@gmail.com>',
        'To: student001@nexatech.edu.kg',
        'Subject: welcome',
        '',
        'Hello world',
      ].join("\r\n")
    );

    expect(parsed.subject).toBe("welcome");
    expect(parsed.textBody).toContain("Hello world");
    expect(parsed.htmlBody).toBeNull();
  });

  it("falls back to plain text rendering for html bodies", () => {
    expect(htmlToPlainText("<p>Hello<br>World</p>")).toBe("Hello\nWorld");
  });

  it("stores the first delivery and records a stored event", async () => {
    const raw = [
      'From: Gmail Sender <sender@gmail.com>',
      'To: student001@nexatech.edu.kg',
      'Subject: welcome',
      'Message-ID: <message-1@example.com>',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      'Hello world',
      '',
    ].join("\r\n");

    await handleEmail(createMockMessage({ raw }), TEST_ENV);

    expect(getRequests(fetchMock, "/rest/v1/mail_messages", "POST")).toHaveLength(1);
    const eventBody = getLastRequestJson<Record<string, unknown>>(
      fetchMock,
      "/rest/v1/mail_ingestion_events"
    );
    expect(eventBody.stage).toBe("store_message");
    expect(eventBody.status).toBe("stored");
  });

  it("deletes retained messages older than 30 days and records cleanup success", async () => {
    fetchMock = createFetchMock({
      mailMessagesDelete: [jsonResponse([{ id: "old-1" }, { id: "old-2" }])],
      ingestionEventsDelete: [jsonResponse([{ id: "event-old-1" }])],
      ingestionFailuresDelete: [jsonResponse([{ id: "failure-old-1" }])],
      jobRunsDelete: [jsonResponse([{ id: "job-old-1" }])],
      jobRunsPost: [jsonResponse([{ id: "cleanup-job-1" }], { status: 201 })],
    });
    vi.stubGlobal("fetch", fetchMock);

    await handleScheduled(createScheduledController(CLEANUP_RETENTION_CRON), TEST_ENV);

    const messageCleanupRequests = getRequests(fetchMock, "/rest/v1/mail_messages", "DELETE");
    expect(messageCleanupRequests).toHaveLength(1);
    expect(String(messageCleanupRequests[0][0])).toContain("received_at=lt.");

    const eventCleanupRequests = getRequests(fetchMock, "/rest/v1/mail_ingestion_events", "DELETE");
    expect(eventCleanupRequests).toHaveLength(1);
    expect(String(eventCleanupRequests[0][0])).toContain("created_at=lt.");

    const failureCleanupRequests = getRequests(fetchMock, "/rest/v1/mail_ingestion_failures", "DELETE");
    expect(failureCleanupRequests).toHaveLength(1);
    expect(String(failureCleanupRequests[0][0])).toContain("created_at=lt.");

    const jobCleanupRequests = getRequests(fetchMock, "/rest/v1/mail_job_runs", "DELETE");
    expect(jobCleanupRequests).toHaveLength(1);
    expect(String(jobCleanupRequests[0][0])).toContain("started_at=lt.");

    const eventBody = getLastRequestJson<Record<string, unknown>>(
      fetchMock,
      "/rest/v1/mail_ingestion_events"
    );
    expect(eventBody.stage).toBe("cleanup_retention");
    expect(eventBody.status).toBe("cleanup_success");
    expect(eventBody.metadata_json).toEqual({
      deleted_messages_count: 2,
      deleted_events_count: 1,
      deleted_failures_count: 1,
      deleted_job_runs_count: 1,
    });

    const jobPatchBody = getLastRequestJson<Record<string, unknown>>(
      fetchMock,
      "/rest/v1/mail_job_runs",
      "PATCH"
    );
    expect(jobPatchBody.status).toBe("success");
  });

  it("cleans only one bounded delete batch per table per scheduled run", async () => {
    fetchMock = createFetchMock({
      mailMessagesDelete: [jsonResponse(Array.from({ length: 100 }, (_value, index) => ({ id: `message-old-${index + 1}` })))],
      ingestionEventsDelete: [jsonResponse(Array.from({ length: 100 }, (_value, index) => ({ id: `event-old-${index + 1}` })))],
      ingestionFailuresDelete: [jsonResponse(Array.from({ length: 100 }, (_value, index) => ({ id: `failure-old-${index + 1}` })))],
      jobRunsDelete: [jsonResponse(Array.from({ length: 100 }, (_value, index) => ({ id: `job-old-${index + 1}` })))],
      jobRunsPost: [jsonResponse([{ id: "cleanup-job-batch" }], { status: 201 })],
    });
    vi.stubGlobal("fetch", fetchMock);

    await handleScheduled(createScheduledController(CLEANUP_RETENTION_CRON), TEST_ENV);

    const messageCleanupRequests = getRequests(fetchMock, "/rest/v1/mail_messages", "DELETE");
    expect(messageCleanupRequests).toHaveLength(1);
    expect(String(messageCleanupRequests[0][0])).toContain("limit=100");

    const eventCleanupRequests = getRequests(fetchMock, "/rest/v1/mail_ingestion_events", "DELETE");
    expect(eventCleanupRequests).toHaveLength(1);
    expect(String(eventCleanupRequests[0][0])).toContain("limit=100");

    const failureCleanupRequests = getRequests(fetchMock, "/rest/v1/mail_ingestion_failures", "DELETE");
    expect(failureCleanupRequests).toHaveLength(1);
    expect(String(failureCleanupRequests[0][0])).toContain("limit=100");

    const jobCleanupRequests = getRequests(fetchMock, "/rest/v1/mail_job_runs", "DELETE");
    expect(jobCleanupRequests).toHaveLength(1);
    expect(String(jobCleanupRequests[0][0])).toContain("limit=100");

    const eventBody = getLastRequestJson<Record<string, unknown>>(
      fetchMock,
      "/rest/v1/mail_ingestion_events"
    );
    expect(eventBody.metadata_json).toEqual({
      deleted_messages_count: 100,
      deleted_events_count: 100,
      deleted_failures_count: 100,
      deleted_job_runs_count: 100,
    });
  });

  it("continues cleanup when event persistence is unavailable", async () => {
    fetchMock = createFetchMock({
      ingestionEventsPost: [new Response("event down", { status: 500, statusText: "Server Error" })],
      jobRunsPost: [jsonResponse([{ id: "cleanup-job-2" }], { status: 201 })],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(handleScheduled(createScheduledController(CLEANUP_RETENTION_CRON), TEST_ENV)).resolves.toBeUndefined();

    expect(getRequests(fetchMock, "/rest/v1/mail_messages", "DELETE")).toHaveLength(1);
  });

  it("continues cleanup when job run persistence is unavailable", async () => {
    fetchMock = createFetchMock({
      jobRunsPost: [new Response("job down", { status: 500, statusText: "Server Error" })],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(handleScheduled(createScheduledController(CLEANUP_RETENTION_CRON), TEST_ENV)).resolves.toBeUndefined();

    expect(getRequests(fetchMock, "/rest/v1/mail_messages", "DELETE")).toHaveLength(1);
  });
});
