import { notFound } from "next/navigation";
import { AdminClientRouteProvider } from "@/components/admin/admin-client-route-context";
import { AdminClientShell } from "@/components/admin/admin-client-shell";
import { PlanQuotaProvider } from "@/components/console/plan-quota-context";
import { getAdminClientEntry } from "@/lib/admin/get-client-entry";
import { getServerStaffAuth } from "@/lib/auth/staff";
import { planSnapshotFromAdminEntry } from "@/lib/plan/get-account-plan";

export default async function AdminClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { userId: string };
}) {
  const ctx = await getServerStaffAuth();
  if (!ctx) notFound();

  const client = await getAdminClientEntry(ctx.supabase, params.userId);
  if (!client) notFound();

  return (
    <PlanQuotaProvider quota={planSnapshotFromAdminEntry(client)}>
      <AdminClientRouteProvider clientId={client.id}>
        <AdminClientShell client={client}>{children}</AdminClientShell>
      </AdminClientRouteProvider>
    </PlanQuotaProvider>
  );
}
