"use client";

import type { AppRelease, Device } from "@signage/types";
import { ArrowUpCircle } from "lucide-react";
import {
  deviceAppUpdateStatus,
  deviceInstalledAppLabel,
  getDeviceInstalledApp,
} from "@/lib/device-app-version";
import { cn } from "@/lib/utils";

type ReleaseRef = Pick<AppRelease, "version_code" | "version_name">;

function updateTooltip(installedLabel: string | null, activeRelease: ReleaseRef | null | undefined): string | undefined {
  if (!activeRelease) return undefined;
  const target = `v${activeRelease.version_name}`;
  if (installedLabel) {
    return `Installed ${installedLabel}. Active release is ${target} — ask the client to confirm Install on the TV.`;
  }
  return `Active release is ${target}. Version not reported yet — open the TV app and sync.`;
}

export function DeviceAppVersionChip({
  device,
  activeRelease,
  compact = false,
  className,
}: {
  device: Device;
  activeRelease: ReleaseRef | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const installed = getDeviceInstalledApp(device);
  const status = deviceAppUpdateStatus(installed, activeRelease);
  const label = deviceInstalledAppLabel(installed);
  const needsUpdate = status === "update_available";
  const title =
    status === "update_available"
      ? updateTooltip(label, activeRelease)
      : label
        ? `TV app ${label}${activeRelease && status === "current" ? " (up to date)" : ""}`
        : "App version not reported yet — open the TV app and sync.";

  return (
    <span
      role="listitem"
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.6875rem] leading-tight tabular-nums",
        needsUpdate
          ? "border-amber-500/45 bg-amber-500/12 text-amber-950 dark:text-amber-100"
          : "border-border/80 bg-muted/35 text-muted-foreground",
        className,
      )}
    >
      {needsUpdate ? (
        <ArrowUpCircle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2.25} aria-hidden />
      ) : null}
      {!compact ? <span className="shrink-0">App</span> : null}
      <span className={cn("min-w-0 truncate font-medium", needsUpdate ? "text-foreground" : "text-foreground/90")}>
        {label ?? "—"}
      </span>
      {needsUpdate && activeRelease && !compact ? (
        <span className="shrink-0 font-normal text-amber-800/90 dark:text-amber-200/90">· update</span>
      ) : null}
    </span>
  );
}

export function DeviceAppUpdateNotice({
  device,
  activeRelease,
  className,
}: {
  device: Device;
  activeRelease: ReleaseRef | null | undefined;
  className?: string;
}) {
  const installed = getDeviceInstalledApp(device);
  const status = deviceAppUpdateStatus(installed, activeRelease);
  if (status !== "update_available" || !activeRelease) return null;

  const installedLabel = deviceInstalledAppLabel(installed) ?? "an older build";

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100",
        className,
      )}
      role="status"
    >
      <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden />
      <p>
        This screen is on <span className="font-medium">{installedLabel}</span>.{" "}
        <span className="font-medium">v{activeRelease.version_name}</span> is available — call the client and ask them to
        confirm <span className="font-medium">Install</span> when the TV prompts for an update.
      </p>
    </div>
  );
}
