"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordForm({ accountId }: { accountId: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/mail/api/admin/mailboxes/${accountId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword }),
      });

      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.success) {
        setMessage(result?.error ?? "Failed to reset password.");
        return;
      }

      setMessage("Password updated.");
      setNewPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        placeholder="New password"
        minLength={8}
        required
        className="h-9 w-40"
      />
      <Button type="submit" variant="outline" disabled={loading}>
        {loading ? "Saving..." : "Reset Password"}
      </Button>
      {message ? <span className="text-xs text-[#64748b]">{message}</span> : null}
    </form>
  );
}
