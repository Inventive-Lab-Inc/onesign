import { notFound } from "next/navigation";
import { AdminPlanEditor } from "@/components/admin/admin-plan-editor";
import { AdminClientOverview } from "@/components/admin/admin-client-shell";
import { AdminDeleteClient } from "@/components/admin/admin-delete-client";
import { getAdminClientEntry } from "@/lib/admin/get-client-entry";
import { getServerStaffAuth } from "@/lib/auth/staff";

export default async function AdminClientOverviewPage({
  params,
}: {
  params: { userId: string };
}) {
  const ctx = await getServerStaffAuth();
  if (!ctx) notFound();

  const client = await getAdminClientEntry(ctx.supabase, params.userId);
  if (!client) notFound();

  const { data: devices, error: devicesError } = await ctx.supabase
    .from("devices")
    .select("id, name, status, last_seen, created_at, paused_by_quota")
    .eq("owner_id", client.id)
    .order("last_seen", { ascending: false, nullsFirst: false });

  if (devicesError) {
    throw new Error(devicesError.message);
  }

  return (
    <AdminClientOverview client={client}>
      <AdminPlanEditor
        userId={client.id}
        deviceLimit={client.device_limit}
        deviceCount={client.device_count}
        storageLimitBytes={client.storage_limit_bytes}
        storageUsedBytes={client.storage_used_bytes}
        devices={devices ?? []}
      />
      <AdminDeleteClient
        userId={client.id}
        email={client.email}
        clientName={client.client_name}
      />
    </AdminClientOverview>
  );
}
