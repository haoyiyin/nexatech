import AccountsTable from "@/components/admin/accounts-table";
import { listMailboxAccounts } from "@/lib/admin/accounts/list-mailbox-accounts";
import { requireAdminSession } from "@/lib/auth/require-admin-session";

interface AdminMailboxesPageProps {
  searchParams?: Promise<{ page?: string | string[]; q?: string | string[] }>;
}

export default async function AdminMailboxesPage({ searchParams }: AdminMailboxesPageProps) {
  const adminUser = await requireAdminSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0]
    : resolvedSearchParams?.q;
  const page = resolvedSearchParams?.page;

  const data = await listMailboxAccounts({
    page,
    query,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a365d]">Mailbox Accounts</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Search, suspend, reactivate, and reset passwords for student mailboxes.
        </p>
      </div>
      <AccountsTable
        mailboxes={data.mailboxes}
        pagination={data.pagination}
        query={data.query}
        currentAdminMailboxId={adminUser.mailboxAccountId}
      />
    </div>
  );
}
