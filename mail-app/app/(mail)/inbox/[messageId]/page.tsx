import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-session";
import { redirect } from "next/navigation";
import MessageView from "@/components/message-view";
import { parsePageParam } from "@/lib/pagination";

interface MessagePageProps {
  params: Promise<{ messageId: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}

export default async function MessagePage({ params, searchParams }: MessagePageProps) {
  const user = await requireSession();
  const { messageId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const hasPageParam = resolvedSearchParams?.page !== undefined;
  const page = hasPageParam ? parsePageParam(resolvedSearchParams?.page) : undefined;
  const supabase = await createClient();

  const { data: message, error: messageError } = await supabase
    .from("mail_messages")
    .select("*")
    .eq("id", messageId)
    .eq("owner_user_id", user.id)
    .single();

  if (messageError) {
    throw new Error("Failed to load message.");
  }

  if (!message) {
    redirect("/inbox");
  }

  return <MessageView message={message} page={page} />;
}
