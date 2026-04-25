import { z } from "zod";

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const EMAIL_PREFIX_PATTERN = /^[a-zA-Z0-9._-]+$/;

const loadTestUserRowSchema = z.object({
  emailPrefix: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(EMAIL_PREFIX_PATTERN, "Email prefix may only contain letters, numbers, dots, underscores, and dashes."),
  password: z.string().min(8).max(128),
  studentId: z.string().trim().max(128).nullable(),
});

const loadTestMessageUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  messageIds: z.array(z.string().uuid()),
});

export const loadTestMessageMapSchema = z.object({
  generatedAt: z.string().min(1),
  domain: z.string().min(1),
  users: z.array(loadTestMessageUserSchema),
});

export interface LoadTestUser {
  emailPrefix: string;
  email: string;
  password: string;
  studentId: string | null;
}

export type LoadTestMessageMap = z.infer<typeof loadTestMessageMapSchema>;

export function normalizeMailDomain(mailDomain: string) {
  const normalizedDomain = mailDomain.trim().toLowerCase();

  if (!DOMAIN_PATTERN.test(normalizedDomain)) {
    throw new Error("MAIL_DOMAIN must be a bare domain such as nexatech.edu.kg.");
  }

  return normalizedDomain;
}

export function buildLoadTestEmail(emailPrefix: string, mailDomain: string) {
  const normalizedDomain = normalizeMailDomain(mailDomain);
  const normalizedPrefix = emailPrefix.trim();

  if (!EMAIL_PREFIX_PATTERN.test(normalizedPrefix)) {
    throw new Error("Email prefix may only contain letters, numbers, dots, underscores, and dashes.");
  }

  return `${normalizedPrefix}@${normalizedDomain}`.toLowerCase();
}

export function parseLoadTestUsersCsv(content: string, mailDomain: string): LoadTestUser[] {
  const normalizedDomain = normalizeMailDomain(mailDomain);
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return [];
  }

  const hasHeader = /email|prefix|password/i.test(lines[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const lineNumber = hasHeader ? index + 2 : index + 1;
    const parts = line.split(",").map((part) => part.trim());

    if (parts.length < 2) {
      throw new Error(`Invalid CSV row at line ${lineNumber}. Expected email_prefix,password[,student_id].`);
    }

    const parsedRow = loadTestUserRowSchema.safeParse({
      emailPrefix: parts[0],
      password: parts[1],
      studentId: parts[2] && parts[2].length > 0 ? parts[2] : null,
    });

    if (!parsedRow.success) {
      throw new Error(`Invalid CSV row at line ${lineNumber}: ${parsedRow.error.issues[0]?.message ?? "Invalid row."}`);
    }

    return {
      emailPrefix: parsedRow.data.emailPrefix,
      email: buildLoadTestEmail(parsedRow.data.emailPrefix, normalizedDomain),
      password: parsedRow.data.password,
      studentId: parsedRow.data.studentId,
    };
  });
}

export function createLoadTestMessageMap(
  users: Array<{ email: string; messageIds: string[] }>,
  mailDomain: string
): LoadTestMessageMap {
  return loadTestMessageMapSchema.parse({
    generatedAt: new Date().toISOString(),
    domain: normalizeMailDomain(mailDomain),
    users: users.map((user) => ({
      email: user.email.trim().toLowerCase(),
      messageIds: [...user.messageIds],
    })),
  });
}

export function parseLoadTestMessageMap(input: unknown) {
  return loadTestMessageMapSchema.parse(input);
}
