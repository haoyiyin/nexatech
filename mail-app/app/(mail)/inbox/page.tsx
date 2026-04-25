import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-session";
import InboxList from "@/components/inbox-list";
import {
  INBOX_PAGE_SIZE,
  getPaginationRange,
  getPaginationState,
  parsePageParam,
} from "@/lib/pagination";

interface InboxPageProps {
  searchParams?: Promise<{ page?: string | string[] }>;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const user = await requireSession();
  const supabase = await createClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedPage = parsePageParam(resolvedSearchParams?.page);

  const [{ data: account }, { count }] = await Promise.all([
    supabase
      .from("mailbox_accounts")
      .select("email_address")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("mail_messages")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id),
  ]);

  const pagination = getPaginationState(requestedPage, count ?? 0, INBOX_PAGE_SIZE);
  const range = getPaginationRange(pagination.currentPage, INBOX_PAGE_SIZE);

  const { data: messages } = await supabase
    .from("mail_messages")
    .select("id, from_address, subject, received_at, is_read")
    .eq("owner_user_id", user.id)
    .order("received_at", { ascending: false })
    .range(range.from, range.to);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a365d]">Inbox</h1>
        <p className="text-sm text-[#64748b] mt-1">
          {account?.email_address ?? "Loading..."}
        </p>
      </div>
      <InboxList
        messages={messages ?? []}
        currentPage={pagination.currentPage}
        hasNextPage={pagination.hasNextPage}
        hasPreviousPage={pagination.hasPreviousPage}
      />
    </div>
  );
}
