import { notFound } from "next/navigation";
import { AdminClientUsersPanel } from "@/components/admin/admin-client-users-panel";
import { getAdminClientEntry } from "@/lib/admin/get-client-entry";
import { getServerStaffAuth } from "@/lib/auth/staff";

export default async function AdminClientUsersPage({
  params,
}: {
  params: { userId: string };
}) {
  const ctx = await getServerStaffAuth();
  if (!ctx) notFound();

  const client = await getAdminClientEntry(ctx.supabase, params.userId);
  if (!client) notFound();

  return (
    <div className="rounded-xl border border-border/90 bg-card p-4 shadow-sm sm:p-5">
      <AdminClientUsersPanel accountId={client.id} />
    </div>
  );
}
