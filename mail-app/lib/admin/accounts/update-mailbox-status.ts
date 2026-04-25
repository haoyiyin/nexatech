import { createAdminClient } from "@/lib/supabase/admin";

export async function updateMailboxStatus({
  accountId,
  status,
}: {
  accountId: string;
  status: "active" | "suspended";
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mailbox_accounts")
    .update({ status })
    .eq("id", accountId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    throw new Error("Failed to update mailbox status.");
  }

  if (!data) {
    throw Object.assign(new Error("Mailbox account not found."), {
      code: "MAILBOX_ACCOUNT_NOT_FOUND" as const,
    });
  }

  return {
    id: data.id,
    status: data.status,
  };
}
