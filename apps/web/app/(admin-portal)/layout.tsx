import { redirect } from "next/navigation";
import { StaffPortalChoiceGate } from "@/components/auth/staff-portal-choice-gate";
import { AdminPortalShell } from "@/components/shell/admin-portal-shell";
import { getServerStaffAuth } from "@/lib/auth/staff";
import { getServerAuth } from "@/lib/supabase/auth";

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getServerStaffAuth();

  if (!ctx) {
    const { user } = await getServerAuth();
    redirect(user ? "/dashboard" : "/login");
  }

  return (
    <StaffPortalChoiceGate isStaff>
      <AdminPortalShell staff={ctx.staff}>{children}</AdminPortalShell>
    </StaffPortalChoiceGate>
  );
}
