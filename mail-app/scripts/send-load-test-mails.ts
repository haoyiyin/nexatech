import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseLoadTestUsersCsv } from "../lib/load-testing/fixtures";

const DEFAULT_USERS_CSV_PATH = "./load-tests/fixtures/users.csv";
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_SUBJECT_PREFIX = "[Load Test]";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }

  return value;
}

function getPositiveInteger(name: string, fallback: number, maximum?: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  if (maximum !== undefined && parsedValue > maximum) {
    throw new Error(`${name} must be less than or equal to ${maximum}.`);
  }

  return parsedValue;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function main() {
  const usersCsvPath = resolve(process.argv[2] || DEFAULT_USERS_CSV_PATH);
  const mailDomain = process.env.MAIL_DOMAIN || "nexatech.edu.kg";
  const batchSize = getPositiveInteger("BATCH_SIZE", DEFAULT_BATCH_SIZE, 100);
  const messagesPerUser = getPositiveInteger("MESSAGES_PER_USER", 1, 100);
  const subjectPrefix = process.env.SUBJECT_PREFIX?.trim() || DEFAULT_SUBJECT_PREFIX;
  const smtpHost = getRequiredEnv("SMTP_HOST");
  const smtpPort = getPositiveInteger("SMTP_PORT", 587);
  const smtpUser = getRequiredEnv("SMTP_USER");
  const smtpPass = getRequiredEnv("SMTP_PASS");
  const fromAddress = getRequiredEnv("SMTP_FROM");
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const users = parseLoadTestUsersCsv(readFileSync(usersCsvPath, "utf8"), mailDomain);

  if (users.length === 0) {
    throw new Error("No load-test users found in users.csv.");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const deliveries = users.flatMap((user) =>
    Array.from({ length: messagesPerUser }, (_, index) => ({
      to: user.email,
      subject: `${subjectPrefix} ${user.email} #${index + 1}`,
      text: [
        `Load-test message ${index + 1} for ${user.email}`,
        `Generated at ${new Date().toISOString()}`,
        "This message is safe to delete after load testing.",
      ].join("\n"),
    }))
  );

  for (const batch of chunkArray(deliveries, batchSize)) {
    await Promise.all(
      batch.map((delivery) =>
        transporter.sendMail({
          from: fromAddress,
          to: delivery.to,
          subject: delivery.subject,
          text: delivery.text,
        })
      )
    );
  }

  process.stdout.write(`Sent ${deliveries.length} load-test messages to ${users.length} users.\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
