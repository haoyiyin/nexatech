import { describe, expect, it } from "vitest";
import {
  buildLoadTestEmail,
  createLoadTestMessageMap,
  parseLoadTestMessageMap,
  parseLoadTestUsersCsv,
} from "./fixtures";

describe("load testing fixtures", () => {
  it("parses load test users from csv with a header and comments", () => {
    const users = parseLoadTestUsersCsv(
      [
        "email_prefix,password,student_id",
        "# comment",
        "loadtest-001,SecurePass1!,S-001",
        "loadtest-002,SecurePass2!,",
      ].join("\n"),
      "nexatech.edu.kg"
    );

    expect(users).toEqual([
      {
        emailPrefix: "loadtest-001",
        email: "loadtest-001@nexatech.edu.kg",
        password: "SecurePass1!",
        studentId: "S-001",
      },
      {
        emailPrefix: "loadtest-002",
        email: "loadtest-002@nexatech.edu.kg",
        password: "SecurePass2!",
        studentId: null,
      },
    ]);
  });

  it("rejects invalid email prefixes", () => {
    expect(() => buildLoadTestEmail("bad prefix", "nexatech.edu.kg")).toThrow(
      "Email prefix may only contain letters, numbers, dots, underscores, and dashes."
    );
  });

  it("creates and validates a message map payload", () => {
    const payload = createLoadTestMessageMap(
      [
        {
          email: "loadtest-001@nexatech.edu.kg",
          messageIds: ["550e8400-e29b-41d4-a716-446655440000"],
        },
      ],
      "nexatech.edu.kg"
    );

    expect(parseLoadTestMessageMap(payload)).toEqual({
      generatedAt: expect.any(String),
      domain: "nexatech.edu.kg",
      users: [
        {
          email: "loadtest-001@nexatech.edu.kg",
          messageIds: ["550e8400-e29b-41d4-a716-446655440000"],
        },
      ],
    });
  });
});
