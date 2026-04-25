import { describe, expect, it } from "vitest";
import { parseLoadTestUsersCsv } from "../lib/load-testing/fixtures";

describe("export load test fixtures prerequisites", () => {
  it("parses fixture users with the shared helper", () => {
    const users = parseLoadTestUsersCsv(
      "email_prefix,password,student_id\nloadtest-001,SecurePass1!,S-001\n",
      "nexatech.edu.kg"
    );

    expect(users).toEqual([
      {
        emailPrefix: "loadtest-001",
        email: "loadtest-001@nexatech.edu.kg",
        password: "SecurePass1!",
        studentId: "S-001",
      },
    ]);
  });
});
