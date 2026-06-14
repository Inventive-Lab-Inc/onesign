"use client";

import type { Device, DeviceStatus } from "@signage/types";
import { FolderOutput, Settings, Trash2, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { deviceDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { ItemActionMenu } from "@/components/console/item-action-menu";
import { DeviceDisabledBadge, deviceDisabledPresentation } from "@/components/device-disabled-notice";
import type { ActiveAppRelease } from "@/hooks/use-active-app-release";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import { effectiveDeviceStatus, formatDeviceLastSeen } from "@/lib/device-status";
import { resolveGroupColor } from "@/lib/device-group-colors";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
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

export function DeviceScreenCard({
  device,
  groups,
  returnGroupId = null,
  activeAppRelease: _activeAppRelease,
  accountDisabled = false,
  canControlPlayback: _canControlPlayback = false,
  canDelete = true,
  onRequestDelete,
  onRemoveFromFolder,
  folderName,
  folders = [],
  onAddToFolder,
  onCreateFolder: _onCreateFolder,
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
  const disabledState = deviceDisabledPresentation(device, accountDisabled);
  const detailHref = deviceDetailPath(device.id, adminRoutes, returnGroupId);
  const groupNames = groups.map((group) => group.name).join(", ");
  const thumbnailUrl = device.thumbnail_storage_path
    ? mediaPublicUrl(device.thumbnail_storage_path)
    : null;

  const groupMenuItems =
    onAddToFolder && folders.length > 0
      ? folders.map((group) => ({
          label: `Add to ${group.name}`,
          onClick: () => onAddToFolder(group.id),
          icon: (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: resolveGroupColor(group.accent_color) }}
              aria-hidden
            />
          ),
        }))
      : [];

  return (
    <li className={cn("device-screen-card group/screen", className)}>
      <Link
        href={detailHref}
        className="device-screen-card__link block overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Open screen: ${device.name}`}
      >
        <div className="device-screen-card__preview relative aspect-[16/10] bg-muted/60">
          {thumbnailUrl ? (
            <Image
              key={device.thumbnail_storage_path ?? device.id}
              src={thumbnailUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 180px"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
              <Tv className="h-7 w-7" strokeWidth={1.25} aria-hidden />
            </div>
          )}
          <div className="absolute bottom-1.5 right-1.5 flex flex-wrap items-center justify-end gap-1">
            <span
              className={cn(
                "inline-flex rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide shadow-sm",
                status === "online" && "bg-emerald-500 text-white",
                status === "offline" && "bg-background/90 text-muted-foreground ring-1 ring-border",
                status === "pending_pairing" && "bg-amber-500 text-white",
              )}
            >
              {statusLabel(status)}
            </span>
            {disabledState.show ? (
              <span className="pointer-events-none">
                <DeviceDisabledBadge
                  accountSuspended={disabledState.accountSuspended}
                  pausedByQuota={disabledState.pausedByQuota}
                />
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-1 border-t border-border/60 p-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground" title={device.name}>
              {device.name}
            </p>
            <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
              {formatDeviceLastSeen(device.last_seen)}
              {groupNames ? ` · ${groupNames}` : ""}
            </p>
          </div>
        </div>
      </Link>

      <div className="absolute right-2 top-2 z-10">
        <ItemActionMenu
          ariaLabel={`Actions for ${device.name}`}
          className="rounded-md bg-background/90 shadow-sm ring-1 ring-border/80 backdrop-blur-sm"
          items={[
            {
              label: "Open settings",
              href: detailHref,
              icon: <Settings className="h-3.5 w-3.5" aria-hidden />,
            },
            ...groupMenuItems,
            ...(onRemoveFromFolder
              ? [
                  {
                    label: folderName ? `Remove from ${folderName}` : "Remove from group",
                    onClick: onRemoveFromFolder,
                    icon: <FolderOutput className="h-3.5 w-3.5" aria-hidden />,
                  },
                ]
              : []),
            ...(canDelete
              ? [
                  {
                    label: "Remove screen",
                    onClick: onRequestDelete,
                    destructive: true,
                    icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
                  },
                ]
              : []),
          ]}
        />
      </div>
    </li>
  );
}
