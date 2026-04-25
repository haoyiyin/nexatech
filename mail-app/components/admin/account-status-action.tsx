"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AccountStatusActionProps {
  accountId: string;
  status: "active" | "suspended";
}

export default function AccountStatusAction({ accountId, status }: AccountStatusActionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStatus = status === "active" ? "suspended" : "active";

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/mail/api/admin/mailboxes/${accountId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.success) {
        setError(result?.error ?? "Failed to update mailbox status.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Failed to update mailbox status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" onClick={handleClick} disabled={loading}>
        {loading ? "Updating..." : nextStatus === "suspended" ? "Suspend" : "Reactivate"}
      </Button>
      {error ? <span className="text-xs text-[#64748b]">{error}</span> : null}
    </div>
  );
}
