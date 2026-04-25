import { createClient } from "@/lib/supabase/server";
import { getWebsiteLoginUrl } from "@/lib/auth/get-website-login-url";
import { redirect } from "next/navigation";

export async function requireSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getWebsiteLoginUrl());
  }

  return user;
}
