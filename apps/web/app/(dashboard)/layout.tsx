import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StaffPortalChoiceGate } from "@/components/auth/staff-portal-choice-gate";
import { PlanQuotaProvider } from "@/components/console/plan-quota-context";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getServerStaffAuth } from "@/lib/auth/staff";
import { getAccountPlanSnapshot } from "@/lib/plan/get-account-plan";
import { getServerAuthWithProfile } from "@/lib/supabase/auth";
import { isTrialExpired } from "@/lib/trial";
import { fetchAccountContext, pickActiveWorkspaceId } from "@/lib/workspace/account-context";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/constants";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [{ user, profile, supabase }, staff] = await Promise.all([
    getServerAuthWithProfile(),
    getServerStaffAuth(),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (profile?.is_disabled) {
    redirect("/account-suspended");
  }

  if (isTrialExpired(profile?.trial_ends_at)) {
    redirect("/trial-expired");
  }

  await supabase.rpc("accept_account_invitations");

  const accountContext = await fetchAccountContext(supabase, user.id);
  const cookieStore = await cookies();
  const preferredWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  const initialActiveWorkspaceId = pickActiveWorkspaceId(accountContext.workspaces, preferredWorkspaceId);

  const plan = await getAccountPlanSnapshot(supabase, accountContext.accountOwnerId);

  const displayName =
    profile?.client_name?.trim() ||
    (user.user_metadata as Record<string, string | undefined> | undefined)?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <StaffPortalChoiceGate isStaff={!!staff}>
      <DashboardShell
        authUserId={user.id}
        initialAccountContext={accountContext}
        initialActiveWorkspaceId={initialActiveWorkspaceId}
        userEmail={user.email ?? ""}
        displayName={displayName}
        isStaff={!!staff}
      >
        <PlanQuotaProvider quota={plan}>{children}</PlanQuotaProvider>
      </DashboardShell>
    </StaffPortalChoiceGate>
  );
}
