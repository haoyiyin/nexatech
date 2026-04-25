import CreateMailboxForm from "@/components/admin/create-mailbox-form";
import { requireAdminSession } from "@/lib/auth/require-admin-session";

export default async function NewMailboxPage() {
  await requireAdminSession();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a365d]">Create Mailbox</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Provision a new student mailbox account without using CLI scripts.
        </p>
      </div>
      <CreateMailboxForm />
    </div>
  );
}
