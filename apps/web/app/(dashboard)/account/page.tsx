import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountSettingsTabs } from "@/components/account/account-settings-tabs";
import "@/components/account/account.css";
import { loadActivePlanCatalog } from "@/lib/plan/load-active-plans";
import { getServerAuthWithProfile } from "@/lib/supabase/auth";

export default async function AccountPage() {
  const { user } = await getServerAuthWithProfile();
  if (!user) redirect("/login");

  const { plans, currency } = await loadActivePlanCatalog(headers().get("x-vercel-ip-country"));

  return (
    <div className="space-y-6 py-1">
      <header className="account-page-header account-page-enter space-y-1.5 pb-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-strong">Console</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Account settings</h1>
        <p className="max-w-lg text-sm text-muted-foreground">Manage teammates, workspaces, and billing.</p>
      </header>

      <Suspense>
        <AccountSettingsTabs plans={plans} currency={currency} />
      </Suspense>
    </div>
  );
}
