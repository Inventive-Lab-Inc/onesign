"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { AccountUsersPanel } from "@/components/account/account-users-panel";
import { AccountWorkspacesPanel } from "@/components/account/account-workspaces-panel";
import { PlansView } from "@/components/plans/plans-view";

const tabs = [
  { id: "users", label: "Users", href: "/account?tab=users" },
  { id: "workspaces", label: "Workspaces", href: "/account?tab=workspaces" },
  { id: "plan", label: "Plan", href: "/account?tab=plan" },
  { id: "api-keys", label: "API Keys", href: "/account?tab=api-keys" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const DEFAULT_TAB: TabId = "users";

function resolveTab(value: string | null): TabId {
  return tabs.some((tab) => tab.id === value) ? (value as TabId) : DEFAULT_TAB;
}

export function AccountSettingsTabs() {
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "users" ? <AccountUsersPanel /> : null}
      {tab === "workspaces" ? <AccountWorkspacesPanel /> : null}
      {tab === "plan" ? <PlansView /> : null}
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
