import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MailHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/inbox" : "/login");
}
