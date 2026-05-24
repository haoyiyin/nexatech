"use client";

import Link from "next/link";
import type { MailboxAccountListItem } from "@/lib/admin/accounts/list-mailbox-accounts";
import AccountStatusAction from "@/components/admin/account-status-action";
import DeleteMailboxAction from "@/components/admin/delete-mailbox-action";
import ResetPasswordForm from "@/components/admin/reset-password-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AccountsTable({
  mailboxes,
  pagination,
  query,
  currentAdminMailboxId,
}: {
  mailboxes: MailboxAccountListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  query: string;
  currentAdminMailboxId?: string;
}) {
  const querySuffix = query ? `&q=${encodeURIComponent(query)}` : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <form action="/mail/admin/mailboxes" className="flex w-full max-w-md gap-2">
          <Input name="q" defaultValue={query} placeholder="Search by email or student ID" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <Link href="/admin/mailboxes/new" className={buttonVariants({ variant: "accent" })}>
          New Mailbox
        </Link>
      </div>

      {mailboxes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-white p-10 text-center text-[#64748b]">
          No mailbox accounts found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
          <table className="min-w-full divide-y divide-[#e2e8f0] text-sm">
            <thead className="bg-[#f8fafc] text-left text-[#475569]">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Student ID</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Role</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {mailboxes.map((mailbox) => (
                <tr key={mailbox.id}>
                  <td className="px-4 py-3 text-[#1e293b]">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{mailbox.emailAddress}</span>
                      <span className="text-xs text-[#64748b] sm:hidden">{mailbox.studentIdentifier ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#475569] hidden sm:table-cell">{mailbox.studentIdentifier ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-[#475569] hidden md:table-cell">{mailbox.role}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                        mailbox.status === "active"
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      )}
                    >
                      {mailbox.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#475569] hidden md:table-cell">
                    {new Date(mailbox.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {mailbox.id !== currentAdminMailboxId ? (
                        <>
                          <AccountStatusAction accountId={mailbox.id} status={mailbox.status} />
                          <DeleteMailboxAction accountId={mailbox.id} />
                        </>
                      ) : null}
                      <ResetPasswordForm accountId={mailbox.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        {pagination.hasPreviousPage ? (
          <Link
            href={`/admin/mailboxes?page=${pagination.currentPage - 1}${querySuffix}`}
            className="inline-flex items-center rounded-md border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#1a365d] transition-colors hover:bg-[#f8fafc]"
          >
            Previous
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-[#94a3b8]">
            Previous
          </span>
        )}
        <span className="text-sm text-[#64748b]">
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        {pagination.hasNextPage ? (
          <Link
            href={`/admin/mailboxes?page=${pagination.currentPage + 1}${querySuffix}`}
            className="inline-flex items-center rounded-md border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#1a365d] transition-colors hover:bg-[#f8fafc]"
          >
            Next
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-[#94a3b8]">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
