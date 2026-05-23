import { createAdminClient } from "@/lib/supabase/admin";
import { SYSTEM_WELCOME_SENDER } from "@/lib/mail/get-sender-display-name";

const MAIL_DOMAIN = (process.env.MAIL_DOMAIN || "nexatech.edu.kg").trim().toLowerCase();
const WELCOME_SUBJECT = "Welcome to Nexatech University";
const WELCOME_TEXT_BODY = `Welcome to Nexatech University.\n\nWe are delighted to welcome you as a new student. Your official school mailbox is now ready to use.\n\nYou can sign in with your username and password to receive school announcements, academic notices, and important campus updates.\n\nWe wish you a successful and inspiring journey at Nexatech University.`;

export interface CreateMailboxAccountInput {
  emailPrefix: string;
  password: string;
  studentIdentifier?: string | null;
}

export interface CreatedMailboxAccount {
  id: string;
  emailAddress: string;
  studentIdentifier: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export async function createMailboxAccount({
  emailPrefix,
  password,
  studentIdentifier,
}: CreateMailboxAccountInput): Promise<CreatedMailboxAccount> {
  const supabase = createAdminClient();
  const normalizedPrefix = emailPrefix.trim().toLowerCase();
  const normalizedEmail = `${normalizedPrefix}@${MAIL_DOMAIN}`;

  const { data: existingAccount, error: existingAccountError } = await supabase
    .from("mailbox_accounts")
    .select("id")
    .eq("email_address", normalizedEmail)
    .maybeSingle();

  if (existingAccountError) {
    throw new Error("Failed to check existing mailbox accounts.");
  }

  if (existingAccount) {
    throw Object.assign(new Error("Mailbox account already exists."), {
      code: "MAILBOX_ACCOUNT_EXISTS" as const,
    });
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authUser.user?.id) {
    throw new Error("Failed to create mailbox account.");
  }

  const authUserId = authUser.user.id;

  const { data: mailboxAccount, error: mailboxAccountError } = await supabase
    .from("mailbox_accounts")
    .insert({
      user_id: authUserId,
      email_address: normalizedEmail,
      student_identifier: studentIdentifier?.trim() || null,
      role: "student",
      status: "active",
    })
    .select("id, email_address, student_identifier, role, status, created_at")
    .single();

  if (mailboxAccountError || !mailboxAccount) {
    await supabase.auth.admin.deleteUser(authUserId);
    throw new Error("Failed to create mailbox account.");
  }

  await supabase.from("mail_messages").insert({
    owner_user_id: authUserId,
    owner_email_address: normalizedEmail,
    message_id_header: `welcome:${mailboxAccount.id}`,
    from_address: SYSTEM_WELCOME_SENDER,
    to_address: normalizedEmail,
    subject: WELCOME_SUBJECT,
    text_body: WELCOME_TEXT_BODY,
    html_body_sanitized: null,
    size_bytes: WELCOME_TEXT_BODY.length,
    headers_json: {
      system: true,
      category: "welcome",
    },
  });

  return {
    id: mailboxAccount.id,
    emailAddress: mailboxAccount.email_address,
    studentIdentifier: mailboxAccount.student_identifier,
    role: mailboxAccount.role,
    status: mailboxAccount.status,
    createdAt: mailboxAccount.created_at,
  };
}
