import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { createLoadTestMessageMap, parseLoadTestUsersCsv } from "../lib/load-testing/fixtures";

const DEFAULT_USERS_CSV_PATH = "./load-tests/fixtures/users.csv";
const DEFAULT_OUTPUT_PATH = "./load-tests/fixtures/message-map.json";
const DEFAULT_MESSAGE_LIMIT = 10;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }

  return value;
}

function getMessageLimit(rawValue: string | undefined) {
  if (!rawValue) {
    return DEFAULT_MESSAGE_LIMIT;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0 || parsedValue > 100) {
    throw new Error("MESSAGE_LIMIT must be an integer between 1 and 100.");
  }

  return parsedValue;
}

async function main() {
  const usersCsvPath = resolve(process.argv[2] || DEFAULT_USERS_CSV_PATH);
  const outputPath = resolve(process.argv[3] || DEFAULT_OUTPUT_PATH);
  const mailDomain = process.env.MAIL_DOMAIN || "nexatech.edu.kg";
  const messageLimit = getMessageLimit(process.env.MESSAGE_LIMIT);
  const csvContent = await readFile(usersCsvPath, "utf8");
  const users = parseLoadTestUsersCsv(csvContent, mailDomain);

  if (users.length === 0) {
    throw new Error("No load-test users found in users.csv.");
  }

  const supabase = createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const messageTargets: Array<{ email: string; messageIds: string[] }> = [];

  for (const [index, user] of users.entries()) {
    const { data, error } = await supabase
      .from("mail_messages")
      .select("id")
      .eq("owner_email_address", user.email)
      .order("received_at", { ascending: false })
      .limit(messageLimit);

    if (error) {
      throw new Error(`Failed to load messages for fixture user #${index + 1}: ${error.message}`);
    }

    messageTargets.push({
      email: user.email,
      messageIds: (data ?? []).map((row) => row.id),
    });
  }

  const payload = createLoadTestMessageMap(messageTargets, mailDomain);
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  process.stdout.write(`Exported message fixtures for ${payload.users.length} users to ${outputPath}.\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
