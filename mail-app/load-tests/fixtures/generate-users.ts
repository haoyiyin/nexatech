/**
 * Generate 100 load-test user accounts.
 * Run: npx tsx load-tests/fixtures/generate-users.ts
 */

const COUNT = Number(process.env.LOAD_TEST_USER_COUNT || 100);
const PASSWORD = process.env.LOAD_TEST_PASSWORD;

if (!PASSWORD) {
  throw new Error("LOAD_TEST_PASSWORD environment variable is required.");
}

const rows = ["email_prefix,password,student_id"];

for (let i = 1; i <= COUNT; i++) {
  const prefix = `loadtest-${String(i).padStart(4, "0")}`;
  rows.push(`${prefix},${PASSWORD},LT-${String(i).padStart(4, "0")}`);
}

process.stdout.write(`${rows.join("\n")}\n`);
