"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function DeleteMailboxAction({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!window.confirm("Delete this mailbox account? This cannot be undone.")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/mail/api/admin/mailboxes/${accountId}/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.success) {
        setError(result?.error ?? "Failed to delete mailbox account.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Failed to delete mailbox account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="destructive" onClick={handleClick} disabled={loading}>
        {loading ? "Deleting..." : "Delete"}
      </Button>
      {error ? <span className="text-xs text-[#64748b]">{error}</span> : null}
    </div>
  );
}
