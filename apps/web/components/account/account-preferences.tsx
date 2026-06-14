"use client";

import { Bell, Globe2, SlidersHorizontal } from "lucide-react";
import { useSettings } from "@/components/shell/settings-context";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AccountSettingRow } from "./account-setting-row";
import { AccountToggle } from "./account-toggle";

export function AccountPreferences() {
  const { settings, setNotifications, setLanguage } = useSettings();

  return (
    <section className="account-page-enter space-y-3">
      <div className="flex items-center gap-2 px-1">
        <SlidersHorizontal className="h-4 w-4 text-brand-strong" strokeWidth={2} aria-hidden />
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Preferences</h2>
          <p className="text-xs text-muted-foreground">How the console behaves for you.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <AccountSettingRow
          icon={Bell}
          title="In-app notifications"
          description="Show alerts and updates while you work in the console."
          control={
            <AccountToggle
              checked={settings.notifications}
              onCheckedChange={setNotifications}
              label="Enable in-app notifications"
            />
          }
        />
        <div className="mx-4 h-px bg-border sm:mx-5" />
        <AccountSettingRow
          icon={Globe2}
          title="Language"
          description="Interface language for menus, labels, and messages."
          control={
            <div className="relative">
              <Label htmlFor="account-language" className="sr-only">
                Language
              </Label>
              <select
                id="account-language"
                value={settings.language}
                onChange={(e) => setLanguage(e.target.value)}
                className={cn(
                  "h-9 min-w-[9.5rem] appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-sm font-medium text-foreground shadow-sm",
                  "transition-colors hover:border-brand-faint25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-faint30",
                )}
              >
                <option value="en">English</option>
              </select>
              <span
                className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground"
                aria-hidden
              >
                ▾
              </span>
            </div>
          }
        />
      </div>
    </section>
  );
}
