import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const OLD_MAIL_DOMAIN = "email.nexatech.edu.kg";
const NEW_MAIL_DOMAIN = (process.env.MAIL_DOMAIN || "nexatech.edu.kg").trim().toLowerCase();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IS_DRY_RUN = process.argv.includes("--dry-run");
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

interface MailboxAccountRow {
  user_id: string;
  email_address: string;
}

interface MigrationTarget {
  userId: string;
  oldEmail: string;
  newEmail: string;
}

let adminClient: SupabaseClient | null = null;

function getAdminClient() {
  if (!adminClient) {
    adminClient = createAdminClient();
  }

  return adminClient;
}

export function getNextEmailAddress(email: string, oldDomain = OLD_MAIL_DOMAIN, newDomain = NEW_MAIL_DOMAIN) {
  const legacySuffix = `@${oldDomain}`;

  if (!email.toLowerCase().endsWith(legacySuffix)) {
    return email;
  }

  return `${email.slice(0, -legacySuffix.length)}@${newDomain}`;
}

function createAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function validateMailDomain() {
  if (!NEW_MAIL_DOMAIN || NEW_MAIL_DOMAIN.includes("@")) {
    throw new Error("MAIL_DOMAIN must be set to a bare domain such as nexatech.edu.kg.");
  }

  if (!DOMAIN_PATTERN.test(NEW_MAIL_DOMAIN)) {
    throw new Error("MAIL_DOMAIN must be a valid hostname such as nexatech.edu.kg.");
  }

  if (NEW_MAIL_DOMAIN === OLD_MAIL_DOMAIN) {
    throw new Error("MAIL_DOMAIN still points to the legacy domain. Set it to nexatech.edu.kg before migrating.");
  }
}

function mapTargets(rows: MailboxAccountRow[]): MigrationTarget[] {
  return rows.map((row) => ({
    userId: row.user_id,
    oldEmail: row.email_address,
    newEmail: getNextEmailAddress(row.email_address),
  }));
}

async function loadTargets() {
  const supabase = adminClient;
  const { data, error } = await supabase
    .from("mailbox_accounts")
    .select("user_id, email_address")
    .ilike("email_address", `%@${OLD_MAIL_DOMAIN}`)
    .order("email_address", { ascending: true });

  if (error) {
    throw new Error(`Failed to load mailbox accounts: ${error.message}`);
  }

  return mapTargets(data ?? []);
}

async function ensureNoMailboxConflicts(targets: MigrationTarget[]) {
  if (targets.length === 0) {
    return;
  }

  const supabase = adminClient;
  const nextEmails = targets.map((target) => target.newEmail);
  const { data, error } = await supabase
    .from("mailbox_accounts")
    .select("user_id, email_address")
    .in("email_address", nextEmails);

  if (error) {
    throw new Error(`Failed to check mailbox conflicts: ${error.message}`);
  }

  if ((data ?? []).length === 0) {
    return;
  }

  const conflictSummary = (data ?? [])
    .map((row) => `${row.email_address} (user ${row.user_id})`)
    .join(", ");

  throw new Error(`Found mailbox_accounts rows already using target emails: ${conflictSummary}`);
}

async function rollbackMailboxAccount(target: MigrationTarget) {
  const supabase = adminClient;
  const { error } = await supabase
    .from("mailbox_accounts")
    .update({ email_address: target.oldEmail })
    .eq("user_id", target.userId)
    .eq("email_address", target.newEmail);

  if (error) {
    throw new Error(`Mailbox rollback failed for ${target.newEmail}: ${error.message}`);
  }
}

async function rollbackAuthUser(target: MigrationTarget) {
  const supabase = adminClient;
  const { error } = await supabase.auth.admin.updateUserById(target.userId, {
    email: target.oldEmail,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Auth rollback failed for ${target.newEmail}: ${error.message}`);
  }
}

async function migrateAccount(target: MigrationTarget) {
  const supabase = adminClient;
  const { error: mailboxError } = await supabase
    .from("mailbox_accounts")
    .update({ email_address: target.newEmail })
    .eq("user_id", target.userId)
    .eq("email_address", target.oldEmail);

  if (mailboxError) {
    throw new Error(`Failed to update mailbox account ${target.oldEmail}: ${mailboxError.message}`);
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(target.userId, {
    email: target.newEmail,
    email_confirm: true,
  });

  if (authError) {
    await rollbackMailboxAccount(target);
    throw new Error(`Failed to update auth user ${target.oldEmail}: ${authError.message}`);
  }

  const { error: messageError } = await supabase
    .from("mail_messages")
    .update({ owner_email_address: target.newEmail })
    .eq("owner_user_id", target.userId)
    .eq("owner_email_address", target.oldEmail);

  if (!messageError) {
    return;
  }

  const rollbackErrors: string[] = [];

  try {
    await rollbackAuthUser(target);
  } catch (error) {
    rollbackErrors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    await rollbackMailboxAccount(target);
  } catch (error) {
    rollbackErrors.push(error instanceof Error ? error.message : String(error));
  }

  const rollbackSummary = rollbackErrors.length > 0 ? ` Rollback errors: ${rollbackErrors.join(" | ")}` : "";
  throw new Error(
    `Failed to update historical message ownership for ${target.oldEmail}: ${messageError.message}.${rollbackSummary}`
  );
}

async function main() {
  validateMailDomain();
  adminClient = getAdminClient();

  const targets = await loadTargets();

  if (targets.length === 0) {
    console.log(`No mailbox accounts found for @${OLD_MAIL_DOMAIN}.`);
    return;
  }

  await ensureNoMailboxConflicts(targets);

  console.log(`Found ${targets.length} mailbox accounts to migrate from @${OLD_MAIL_DOMAIN} to @${NEW_MAIL_DOMAIN}.`);
  targets.forEach((target) => {
    console.log(`- ${target.oldEmail} -> ${target.newEmail}`);
  });

  if (IS_DRY_RUN) {
    console.log("Dry run complete. No changes were written.");
    return;
  }

  for (const target of targets) {
    console.log(`Migrating ${target.oldEmail}...`);
    await migrateAccount(target);
    console.log(`Migrated ${target.oldEmail} -> ${target.newEmail}`);
  }

  console.log(`Successfully migrated ${targets.length} mailbox accounts.`);
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
