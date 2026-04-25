import DashboardCards from "@/components/admin/dashboard-cards";
import ManualCleanupForm from "@/components/admin/manual-cleanup-form";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard/get-admin-dashboard-metrics";
import { requireAdminSession } from "@/lib/auth/require-admin-session";

export default async function AdminDashboardPage() {
  await requireAdminSession();
  const metrics = await getAdminDashboardMetrics();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a365d]">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Monitor mailbox account health and recent inbound activity.
        </p>
      </div>
      <DashboardCards metrics={metrics} />
      <ManualCleanupForm />
    </div>
  );
}
