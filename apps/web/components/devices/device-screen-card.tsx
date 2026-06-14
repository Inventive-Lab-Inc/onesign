"use client";

import type { Device, DeviceStatus } from "@signage/types";
import { FolderOutput, Settings, Trash2, Tv } from "lucide-react";
import Link from "next/link";
import { deviceDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { DeviceAppVersionChip } from "@/components/device-app-version-chip";
import { DeviceDisabledBadge, deviceDisabledPresentation } from "@/components/device-disabled-notice";
import { DeviceGroupChip } from "@/components/device-groups/device-group-chip";
import { DeviceMediaCacheChip } from "@/components/device-media-cache-chip";
import { DevicePlaybackPowerButton } from "@/components/device-playback-toggle";
import { deviceTelemetrySummaryLine } from "@/components/device-telemetry-panel";
import type { ActiveAppRelease } from "@/hooks/use-active-app-release";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import { DeviceAddToFolderButton } from "@/components/devices/device-add-to-folder-button";
import { effectiveDeviceStatus, formatDeviceLastSeen } from "@/lib/device-status";
import { resolveGroupColor } from "@/lib/device-group-colors";
import { cn } from "@/lib/utils";
import "./device-screen-card.css";

function statusLabel(status: DeviceStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "pending_pairing":
      return "Pending";
    default:
      return status;
  }
}

function resolveDeviceAccent(
  status: DeviceStatus,
  groups: DeviceGroupWithMembers[],
): string {
  const primaryGroup = groups.at(0);
  if (primaryGroup) return resolveGroupColor(primaryGroup.accent_color);
  if (status === "online") return "var(--theme)";
  if (status === "pending_pairing") return "#b45309";
  return "#64748b";
}

export function DeviceScreenCard({
  device,
  groups,
  returnGroupId = null,
  activeAppRelease,
  accountDisabled = false,
  canControlPlayback = false,
  canDelete = true,
  onRequestDelete,
  onRemoveFromFolder,
  folderName,
  folders = [],
  onAddToFolder,
  onCreateFolder,
  className,
}: {
  device: DeviceWithAssignments | Device;
  groups: DeviceGroupWithMembers[];
  returnGroupId?: string | null;
  activeAppRelease: ActiveAppRelease | null;
  accountDisabled?: boolean;
  canControlPlayback?: boolean;
  canDelete?: boolean;
  onRequestDelete: () => void;
  onRemoveFromFolder?: () => void;
  folderName?: string;
  folders?: DeviceGroupWithMembers[];
  onAddToFolder?: (groupId: string) => void;
  onCreateFolder?: () => void;
  className?: string;
}) {
  const adminRoutes = useAdminClientRoutes();
  const status = effectiveDeviceStatus(device);
  const accent = resolveDeviceAccent(status, groups);
  const deviceSummary = deviceTelemetrySummaryLine(device);
  const disabledState = deviceDisabledPresentation(device, accountDisabled);
  const detailHref = deviceDetailPath(device.id, adminRoutes, returnGroupId);

  return (
    <li
      className={cn("device-screen-card group/screen", className)}
      style={{ "--screen-accent": accent } as React.CSSProperties}
    >
      <div className="device-screen-card__glass">
        <div className="device-screen-card__sheen" aria-hidden />
        <div className="device-screen-card__glow" aria-hidden />
        <Link
          href={detailHref}
          className="device-screen-card__link ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Open screen: ${device.name}`}
        />

        <div className="device-screen-card__header pointer-events-none">
          <div className="device-screen-card__icon" aria-hidden>
            <Tv strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="device-screen-card__title" title={device.name}>
              {device.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {deviceSummary ? (
                <span className="device-screen-card__model" title={deviceSummary}>
                  {deviceSummary}
                </span>
              ) : null}
            </div>
            <p className="device-screen-card__subtitle">
              Active · {formatDeviceLastSeen(device.last_seen)}
            </p>
            {groups.length > 0 ? (
              <div className="device-screen-card__groups">
                {groups.map((group) => (
                  <DeviceGroupChip key={group.id} name={group.name} accentColor={group.accent_color} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="device-screen-card__meta pointer-events-none">
          <div className="device-screen-card__meta-row">
            <span
              className={cn(
                "device-screen-card__status",
                status === "online" && "device-screen-card__status--online",
                status === "offline" && "device-screen-card__status--offline",
                status === "pending_pairing" && "device-screen-card__status--pending",
              )}
            >
              {statusLabel(status)}
            </span>
            {disabledState.show ? (
              <DeviceDisabledBadge
                accountSuspended={disabledState.accountSuspended}
                pausedByQuota={disabledState.pausedByQuota}
              />
            ) : null}
          </div>
          <div className="device-screen-card__meta-row">
            <DeviceAppVersionChip device={device} activeRelease={activeAppRelease} compact />
            <DeviceMediaCacheChip device={device} compact />
          </div>
        </div>

        <div className="device-screen-card__footer">
          <div className="device-screen-card__footer-group">
            {onAddToFolder ? (
              <DeviceAddToFolderButton
                deviceName={device.name}
                folders={folders}
                onAddToFolder={onAddToFolder}
                onCreateFolder={onCreateFolder}
                layout="grid"
              />
            ) : null}
            {onRemoveFromFolder ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveFromFolder();
                }}
                className="device-screen-card__btn device-screen-card__btn--folder"
                title={folderName ? `Remove from ${folderName}` : "Remove from folder"}
                aria-label={`Remove ${device.name} from folder`}
              >
                <FolderOutput className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRequestDelete();
                }}
                className="device-screen-card__btn device-screen-card__btn--danger"
                aria-label={`Remove ${device.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="device-screen-card__footer-group">
            {canControlPlayback ? (
              <DevicePlaybackPowerButton
                device={device}
                variant="secondary"
                className="device-screen-card__btn"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
            ) : null}
            <Link
              href={detailHref}
              aria-label={`Settings for ${device.name}`}
              className="device-screen-card__btn"
              onClick={(e) => e.stopPropagation()}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
