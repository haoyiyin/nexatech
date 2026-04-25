import { createAdminClient } from "@/lib/supabase/admin";

export async function resetMailboxPassword({
  accountId,
  newPassword,
}: {
  accountId: string;
  newPassword: string;
}) {
  const supabase = createAdminClient();
  const { data: mailboxAccount, error: mailboxAccountError } = await supabase
    .from("mailbox_accounts")
    .select("id, user_id")
    .eq("id", accountId)
    .maybeSingle();

  if (mailboxAccountError) {
    throw new Error("Failed to load mailbox account.");
  }

  if (!mailboxAccount) {
    throw Object.assign(new Error("Mailbox account not found."), {
      code: "MAILBOX_ACCOUNT_NOT_FOUND" as const,
    });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(mailboxAccount.user_id, {
    password: newPassword,
  });

  if (updateError) {
    throw new Error("Failed to reset mailbox password.");
  }

  return {
    id: mailboxAccount.id,
    passwordUpdated: true,
  };
}
