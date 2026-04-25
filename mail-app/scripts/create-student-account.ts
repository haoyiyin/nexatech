/**
 * Admin script: Create a single student account.
 * Usage: npx tsx scripts/create-student-account.ts <email-prefix> <password> [student-id]
 * Example: npx tsx scripts/create-student-account.ts student001 Password123! S-2025-001
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from "@supabase/supabase-js";

const MAIL_DOMAIN = (process.env.MAIL_DOMAIN || "nexatech.edu.kg").trim().toLowerCase();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: npx tsx scripts/create-student-account.ts <email-prefix> <password> [student-id]");
    process.exit(1);
  }

  const [prefix, password, studentId] = args;
  const email = `${prefix}@${MAIL_DOMAIN}`;

  if (password.length < 8) {
    console.error("Password must be at least 8 characters long.");
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

  const { data: existingAccount, error: existingAccountError } = await supabase
    .from("mailbox_accounts")
    .select("id")
    .eq("email_address", email)
    .maybeSingle();

  if (existingAccountError) {
    console.error("Failed to check existing account:", existingAccountError.message);
    process.exit(1);
  }

  if (existingAccount) {
    console.log(`Account already exists: ${email}`);
    return;
  }

  // 1. Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error("Auth creation failed:", authError.message);
    process.exit(1);
  }

  const authUserId = authUser.user?.id;

  if (!authUserId) {
    console.error("Auth creation failed: missing user id.");
    process.exit(1);
  }

  // 2. Create mailbox account
  const { error: accountError } = await supabase
    .from("mailbox_accounts")
    .insert({
      user_id: authUserId,
      email_address: email,
      student_identifier: studentId || null,
      role: "student",
      status: "active",
    });

  if (accountError) {
    console.error("Account creation failed:", accountError.message);
    // Clean up auth user if account creation fails
    await supabase.auth.admin.deleteUser(authUserId);
    process.exit(1);
  }

  console.log(`Created student account: ${email}`);
  if (studentId) {
    console.log(`  Student ID: ${studentId}`);
  }
  console.log("  Share the initial password through your secure provisioning workflow.");
  console.log("  (Student should change password on first login)");
}

main();
