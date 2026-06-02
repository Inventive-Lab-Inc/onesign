"use client";

import { AppReleasesManager } from "@/components/app-releases-manager";
import { useSettings } from "@/components/shell/settings-context";
import { Label } from "@/components/ui/label";
import { useConsoleDataStore } from "@/stores/console-data-store";

export default function SettingsPage() {
  const { settings, setNotifications, setLanguage } = useSettings();
  const ownerId = useConsoleDataStore((s) => s.ownerId);

  return (
    <div className="mx-auto max-w-4xl space-y-1 py-1">
      <h1 className="text-lg font-bold text-foreground">Settings</h1>

      {ownerId ? <AppReleasesManager userId={ownerId} /> : null}

      <section className="mb-7 space-y-3 border-b border-border pb-7">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
          <p className="text-sm text-muted-foreground">Show in-app notifications and updates.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="h-[1.125rem] w-[1.125rem] accent-brand"
          />
          <span className="text-sm text-foreground">Enable in-app notifications</span>
        </label>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Language</h2>
          <p className="text-sm text-muted-foreground">Preferred language for the interface.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-language" className="sr-only">
            Language
          </Label>
          <select
            id="settings-language"
            value={settings.language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="en">English</option>
          </select>
        </div>
      </section>
    </div>
  );
}
