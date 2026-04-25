import MailLayout from "@/components/mail-layout";
import { requireSession } from "@/lib/auth/require-session";
import { getUsernameFromEmail } from "@/lib/mail/get-username-from-email";
import { createClient } from "@/lib/supabase/server";

export default async function MailRoutesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const supabase = await createClient();
  const { data: mailboxAccount } = await supabase
    .from("mailbox_accounts")
    .select("email_address")
    .eq("user_id", user.id)
    .maybeSingle();

  return <MailLayout username={getUsernameFromEmail(mailboxAccount?.email_address)}>{children}</MailLayout>;
}
