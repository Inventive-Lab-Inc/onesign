import { redirect } from "next/navigation";
import { PlanQuotaProvider } from "@/components/console/plan-quota-context";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getAccountPlanSnapshot } from "@/lib/plan/get-account-plan";
import { getServerAuthWithProfile } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getServerAuthWithProfile();

  if (!user) {
    redirect("/login");
  }

  if (profile?.is_disabled) {
    redirect("/account-suspended");
  }

  const displayName =
    profile?.client_name?.trim() ||
    (user.user_metadata as Record<string, string | undefined> | undefined)?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "User";
  const plan = await getAccountPlanSnapshot(supabase, user.id);

  return (
    <PlanQuotaProvider quota={plan}>
      <DashboardShell authUserId={user.id} userEmail={user.email ?? ""} displayName={displayName}>
        {children}
      </DashboardShell>
    </PlanQuotaProvider>
  );
}
