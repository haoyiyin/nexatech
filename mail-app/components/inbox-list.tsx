"use client";

import Link from "next/link";
import { Mail, MailOpen } from "lucide-react";
import { getSenderDisplayName } from "@/lib/mail/get-sender-display-name";
import { cn } from "@/lib/utils";

interface InboxMessage {
  id: string;
  from_address: string;
  subject: string | null;
  received_at: string;
  is_read: boolean;
}

interface InboxListProps {
  messages: InboxMessage[];
  currentPage: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export default function InboxList({
  messages,
  currentPage,
  hasPreviousPage,
  hasNextPage,
}: InboxListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#64748b]">
        <Mail className="w-12 h-12 mb-4" />
        <p className="text-lg font-medium">No messages yet</p>
        <p className="text-sm mt-1">
          Your inbox will appear here when you receive messages
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-[#e2e8f0] divide-y divide-[#e2e8f0]">
        {messages.map((msg) => (
          <Link
            key={msg.id}
            href={`/inbox/${msg.id}?page=${currentPage}`}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#f8fafc] transition-colors",
              !msg.is_read && "bg-blue-50/50"
            )}
          >
            <div className="shrink-0">
              {msg.is_read ? (
                <MailOpen className="w-5 h-5 text-[#64748b]" />
              ) : (
                <Mail className="w-5 h-5 text-[#1a365d]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-sm truncate",
                    !msg.is_read && "font-semibold text-[#1a365d]"
                  )}
                >
                  {getSenderDisplayName(msg.from_address)}
                </span>
                <span className="text-xs text-[#64748b] shrink-0">
                  {formatDate(msg.received_at)}
                </span>
              </div>
              <p
                className={cn(
                  "text-sm text-[#64748b] truncate mt-0.5",
                  !msg.is_read && "font-medium text-[#334155]"
                )}
              >
                {msg.subject || "(No subject)"}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={hasPreviousPage ? `/inbox?page=${currentPage - 1}` : "/inbox"}
          aria-disabled={!hasPreviousPage}
          className={cn(
            "inline-flex items-center rounded-md border px-3 sm:px-4 py-2 text-sm font-medium transition-colors",
            hasPreviousPage
              ? "border-[#cbd5e1] bg-white text-[#1a365d] hover:bg-[#f8fafc]"
              : "pointer-events-none border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]"
          )}
        >
          Previous
        </Link>
        <span className="text-sm text-[#64748b]">Page {currentPage}</span>
        <Link
          href={hasNextPage ? `/inbox?page=${currentPage + 1}` : `/inbox?page=${currentPage}`}
          aria-disabled={!hasNextPage}
          className={cn(
            "inline-flex items-center rounded-md border px-3 sm:px-4 py-2 text-sm font-medium transition-colors",
            hasNextPage
              ? "border-[#cbd5e1] bg-white text-[#1a365d] hover:bg-[#f8fafc]"
              : "pointer-events-none border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]"
          )}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (days < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
