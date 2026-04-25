import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminDashboardMetrics } from "@/lib/admin/dashboard/get-admin-dashboard-metrics";

export default function DashboardCards({ metrics }: { metrics: AdminDashboardMetrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Active Mailboxes" value={metrics.activeMailboxCount} />
      <MetricCard label="Suspended Mailboxes" value={metrics.suspendedMailboxCount} />
      <MetricCard label="Messages (24h)" value={metrics.messagesReceivedLast24Hours} />
      <MetricCard label="Failures (24h)" value={metrics.failedInboundLast24Hours} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-[#64748b]">Last Cleanup</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.lastCleanupJob ? (
            <div className="space-y-1">
              <p className="text-2xl font-semibold text-[#1a365d] capitalize">
                {metrics.lastCleanupJob.status}
              </p>
              <p className="text-xs text-[#64748b]">Started {formatTimestamp(metrics.lastCleanupJob.startedAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-[#64748b]">No cleanup job recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-[#64748b]">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-[#1a365d]">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}
