/**
 * Admin script: Bulk import student accounts from CSV.
 * Usage: npx tsx scripts/import-students-csv.ts <path-to-csv>
 *
 * CSV format (no header required, but first line can be skipped if present):
 *   email_prefix,password,student_id
 *
 * Example CSV:
 *   student001,SecurePass1!,S-2025-001
 *   student002,SecurePass2!,S-2025-002
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const MAIL_DOMAIN = (process.env.MAIL_DOMAIN || "nexatech.edu.kg").trim().toLowerCase();

interface StudentRow {
  emailPrefix: string;
  password: string;
  studentId: string;
}

function parseCsv(filePath: string): StudentRow[] {
  const content = readFileSync(resolve(filePath), "utf-8");
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  // Skip header line if it looks like a header
  const startIdx =
    lines[0].toLowerCase().includes("prefix") ||
    lines[0].toLowerCase().includes("email") ||
    lines[0].toLowerCase().includes("password")
      ? 1
      : 0;

  const rows: StudentRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length < 2) continue;
    rows.push({
      emailPrefix: parts[0],
      password: parts[1],
      studentId: parts[2] || "",
    });
  }
  return rows;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.log("Usage: npx tsx scripts/import-students-csv.ts <path-to-csv>");
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const students = parseCsv(csvPath);
  console.log(`Found ${students.length} students to import from ${csvPath}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const student of students) {
    const email = `${student.emailPrefix}@${MAIL_DOMAIN}`;

    if (student.password.length < 8) {
      console.error(`[FAIL] ${email} - Password must be at least 8 characters long`);
      failed++;
      continue;
    }

    try {
      const { data: existing, error: existingError } = await supabase
        .from("mailbox_accounts")
        .select("id")
        .eq("email_address", email)
        .maybeSingle();

      if (existingError) {
        console.error(`[FAIL] ${email} - ${existingError.message}`);
        failed++;
        continue;
      }

      if (existing) {
        console.log(`[SKIP] ${email} - already exists`);
        skipped++;
        continue;
      }

      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password: student.password,
          email_confirm: true,
        });

      if (authError) {
        console.error(`[FAIL] ${email} - ${authError.message}`);
        failed++;
        continue;
      }

      const authUserId = authUser.user?.id;

      if (!authUserId) {
        console.error(`[FAIL] ${email} - Auth returned no user id`);
        failed++;
        continue;
      }

      const { error: accountError } = await supabase
        .from("mailbox_accounts")
        .insert({
          user_id: authUserId,
          email_address: email,
          student_identifier: student.studentId || null,
          role: "student",
          status: "active",
        });

      if (accountError) {
        console.error(`[FAIL] ${email} - ${accountError.message}`);
        await supabase.auth.admin.deleteUser(authUserId);
        failed++;
        continue;
      }

      console.log(`[OK] ${email}`);
      created++;
    } catch (err) {
      console.error(`[ERROR] ${email} - ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Total:   ${students.length}`);
}

main();
