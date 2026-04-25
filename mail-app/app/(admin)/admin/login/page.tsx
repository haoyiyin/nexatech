import { createClient } from "@/lib/supabase/server";
import AdminLoginForm from "@/components/admin-login-form";
import { redirect } from "next/navigation";

export default async function AdminLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: mailboxAccount } = await supabase
      .from("mailbox_accounts")
      .select("role, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (mailboxAccount?.role === "admin" && mailboxAccount.status === "active") {
      redirect("/admin");
    }
  }

  return <AdminLoginForm />;
}
