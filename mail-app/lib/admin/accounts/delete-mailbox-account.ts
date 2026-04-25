import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteMailboxAccount({ accountId }: { accountId: string }) {
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

  await supabase.from("mail_messages").delete().eq("owner_user_id", mailboxAccount.user_id);

  const { error: deleteError } = await supabase.auth.admin.deleteUser(mailboxAccount.user_id);

  if (deleteError) {
    throw new Error("Failed to delete mailbox account.");
  }

  return {
    id: mailboxAccount.id,
    deleted: true,
  };
}
