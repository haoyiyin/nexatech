import AdminLayout from "@/components/admin-layout";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { getUsernameFromEmail } from "@/lib/mail/get-username-from-email";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await requireAdminSession();
  const supabase = await createClient();
  const { data: mailboxAccount } = await supabase
    .from("mailbox_accounts")
    .select("email_address")
    .eq("id", adminUser.mailboxAccountId)
    .maybeSingle();

  return <AdminLayout username={getUsernameFromEmail(mailboxAccount?.email_address)}>{children}</AdminLayout>;
}
