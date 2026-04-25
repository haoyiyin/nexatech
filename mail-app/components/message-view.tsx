"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSenderDisplayName } from "@/lib/mail/get-sender-display-name";
import { htmlToPlainText } from "@/lib/mail/sanitize-message";

interface MessageViewProps {
  message: {
    id: string;
    owner_user_id: string;
    from_address: string;
    to_address: string;
    subject: string | null;
    text_body: string | null;
    html_body_sanitized: string | null;
    received_at: string;
    is_read: boolean;
  };
  page?: number;
}

export default function MessageView({ message, page }: MessageViewProps) {
  const [markReadError, setMarkReadError] = useState(false);

  useEffect(() => {
    let isActive = true;

    setMarkReadError(false);

    if (message.is_read) {
      return () => {
        isActive = false;
      };
    }

    const supabase = createClient();

    const markMessageAsRead = async () => {
      const { error } = await supabase
        .from("mail_messages")
        .update({ is_read: true })
        .eq("id", message.id)
        .eq("owner_user_id", message.owner_user_id)
        .eq("is_read", false);

      if (error && isActive) {
        setMarkReadError(true);
      }
    };

    void markMessageAsRead();

    return () => {
      isActive = false;
    };
  }, [message.id, message.is_read, message.owner_user_id]);

  const receivedAt = new Date(message.received_at);
  const formattedReceivedAt = Number.isNaN(receivedAt.getTime())
    ? "Unknown date"
    : receivedAt.toLocaleString();

  const body = message.text_body
    ? message.text_body
    : message.html_body_sanitized
      ? htmlToPlainText(message.html_body_sanitized)
      : "(No content)";

  const backHref = page && page > 1 ? `/inbox?page=${page}` : "/inbox";

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-[#1a365d] transition-colors hover:bg-[#f1f5f9]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Inbox
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        {markReadError ? (
          <div className="border-b border-[#e2e8f0] bg-amber-50 px-6 py-3 text-sm text-amber-800">
            We could not update this message as read. Please refresh and try again.
          </div>
        ) : null}

        <div className="p-6 border-b border-[#e2e8f0]">
          <h2 className="text-xl font-semibold text-[#1a365d] mb-4">
            {message.subject || "(No subject)"}
          </h2>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#64748b] w-16">From:</span>
              <span className="text-[#334155]">{getSenderDisplayName(message.from_address)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#64748b] w-16">To:</span>
              <span className="text-[#334155]">{message.to_address}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#64748b] w-16">Date:</span>
              <span className="text-[#334155] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {formattedReceivedAt}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 whitespace-pre-wrap text-[#334155] leading-relaxed text-sm">
          {body}
        </div>
      </div>
    </div>
  );
}
