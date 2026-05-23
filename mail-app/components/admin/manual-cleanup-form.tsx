"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CleanupSummary {
  deleted_messages_count: number;
  deleted_events_count: number;
  deleted_failures_count: number;
  deleted_job_runs_count: number;
  deleted_rate_limits_count: number;
}

export default function ManualCleanupForm() {
  const router = useRouter();
  const [retentionDays, setRetentionDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const parsedRetentionDays = Number.parseInt(retentionDays, 10);

    if (!Number.isInteger(parsedRetentionDays) || parsedRetentionDays < 1) {
      setError("Please provide a valid retention window in days.");
      setLoading(false);
      return;
    }

    if (
      !window.confirm(
        `Delete all mail older than ${parsedRetentionDays} days across all users? This cannot be undone.`
      )
    ) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/mail/api/admin/retention/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          retentionDays: parsedRetentionDays,
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: CleanupSummary;
      } | null;

      if (!response.ok || !result?.success || !result.data) {
        setError(result?.error ?? "Failed to run retention cleanup.");
        return;
      }

      setSuccess(
        `Deleted ${result.data.deleted_messages_count} messages older than ${parsedRetentionDays} days. Also removed ${result.data.deleted_events_count} events, ${result.data.deleted_failures_count} failures, and ${result.data.deleted_job_runs_count} job records.`
      );
      router.refresh();
    } catch {
      setError("Failed to run retention cleanup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#e2e8f0] bg-white p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1a365d]">Manual Retention Cleanup</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Delete mail older than the specified number of days across all users.
        </p>
      </div>

      <div className="space-y-2 max-w-xs">
        <Label htmlFor="retentionDays">Retention window (days)</Label>
        <Input
          id="retentionDays"
          type="number"
          min={1}
          step={1}
          value={retentionDays}
          onChange={(event) => setRetentionDays(event.target.value)}
          required
        />
      </div>

      <Button type="submit" variant="destructive" disabled={loading}>
        {loading ? "Running cleanup..." : "Run Cleanup"}
      </Button>

      {error ? <p className="text-sm text-[#dc2626]">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}
    </form>
  );
}
