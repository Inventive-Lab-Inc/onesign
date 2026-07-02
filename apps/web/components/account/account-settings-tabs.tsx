"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { AccountUsersPanel } from "@/components/account/account-users-panel";
import { AccountWorkspacesPanel } from "@/components/account/account-workspaces-panel";
import { BillingSettingsView } from "@/components/billing/billing-settings-view";
import type { PlanViewModel } from "@/components/plans/plan-data";
import type { PlanCurrency } from "@/lib/plan-currency";

const tabs = [
  { id: "users", label: "Users", href: "/account?tab=users" },
  { id: "workspaces", label: "Workspaces", href: "/account?tab=workspaces" },
  { id: "billing", label: "Billing", href: "/account?tab=billing" },
  { id: "api-keys", label: "API Keys", href: "/account?tab=api-keys" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const DEFAULT_TAB: TabId = "users";

function resolveTab(value: string | null): TabId {
  if (value === "plan") return "billing";
  return tabs.some((tab) => tab.id === value) ? (value as TabId) : DEFAULT_TAB;
}

export function AccountSettingsTabs({
  plans,
  currency,
}: {
  plans: PlanViewModel[];
  currency: PlanCurrency;
}) {
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));

  return (
    <div className="space-y-8">
      <nav className="-mb-px flex flex-wrap gap-1 border-b border-border">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "users" ? <AccountUsersPanel /> : null}
      {tab === "workspaces" ? <AccountWorkspacesPanel /> : null}
      {tab === "billing" ? <BillingSettingsView plans={plans} currency={currency} /> : null}
      {tab === "api-keys" ? <ApiKeysPlaceholder /> : null}
    </div>
  );
}

function ApiKeysPlaceholder() {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <KeyRound className="mb-3 h-10 w-10 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <p className="text-sm font-medium text-foreground">API keys are coming soon</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        Programmatic access to manage screens, content, and playlists will be available here.
      </p>
    </div>
  );
}
