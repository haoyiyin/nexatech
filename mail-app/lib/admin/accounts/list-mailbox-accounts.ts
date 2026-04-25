import {
  getPaginationRange,
  getPaginationState,
  parsePageParam,
} from "@/lib/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

export const ADMIN_MAILBOX_PAGE_SIZE = 20;

export interface MailboxAccountListItem {
  id: string;
  emailAddress: string;
  studentIdentifier: string | null;
  role: string;
  status: "active" | "suspended";
  createdAt: string;
}

export interface MailboxAccountListResult {
  mailboxes: MailboxAccountListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  query: string;
}

export async function listMailboxAccounts({
  page,
  query,
}: {
  page?: number | string | string[];
  query?: string;
}): Promise<MailboxAccountListResult> {
  const supabase = createAdminClient();
  const currentQuery = query?.trim() ?? "";
  const requestedPage = typeof page === "number" ? page : parsePageParam(page);

  let countQuery = supabase.from("mailbox_accounts").select("id", { count: "exact", head: true });
  let dataQuery = supabase
    .from("mailbox_accounts")
    .select("id, email_address, student_identifier, role, status, created_at")
    .order("created_at", { ascending: false });

  if (currentQuery) {
    const filter = `email_address.ilike.%${currentQuery}%,student_identifier.ilike.%${currentQuery}%`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    throw new Error("Failed to load mailbox accounts.");
  }

  const pagination = getPaginationState(requestedPage, count ?? 0, ADMIN_MAILBOX_PAGE_SIZE);
  const range = getPaginationRange(pagination.currentPage, ADMIN_MAILBOX_PAGE_SIZE);

  const { data, error } = await dataQuery.range(range.from, range.to);

  if (error) {
    throw new Error("Failed to load mailbox accounts.");
  }

  return {
    mailboxes: (data ?? []).map((mailbox) => ({
      id: mailbox.id,
      emailAddress: mailbox.email_address,
      studentIdentifier: mailbox.student_identifier,
      role: mailbox.role,
      status: mailbox.status,
      createdAt: mailbox.created_at,
    })),
    pagination,
    query: currentQuery,
  };
}
