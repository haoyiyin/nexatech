import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: mailboxAccount, error } = await supabase
    .from("mailbox_accounts")
    .select("id, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to verify administrator access.");
  }

  if (!mailboxAccount || mailboxAccount.role !== "admin" || mailboxAccount.status !== "active") {
    redirect("/admin/login");
  }

  return {
    ...user,
    mailboxAccountId: mailboxAccount.id,
  };
}
