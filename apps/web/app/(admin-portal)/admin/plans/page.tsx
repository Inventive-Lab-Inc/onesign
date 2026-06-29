import { redirect } from "next/navigation";
import type { PlanTemplate } from "@signage/types";
import { AdminPlansManager } from "@/components/admin/admin-plans-manager";
import { getServerStaffAuth } from "@/lib/auth/staff";

export default async function AdminPlansPage() {
  const ctx = await getServerStaffAuth();
  if (!ctx) redirect("/login?next=/admin/plans");

  const { data, error } = await ctx.supabase.rpc("admin_list_plans");
  if (error) {
    throw new Error(error.message);
  }

  const plans = (data as PlanTemplate[]) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Plans</h1>
        <p className="text-sm text-muted-foreground">
          The subscription catalog customers see on the pricing page. Active plans publish instantly;
          screen and storage limits here become the defaults you apply to a client&apos;s account.
        </p>
      </div>
      <AdminPlansManager plans={plans} />
    </div>
  );
}
