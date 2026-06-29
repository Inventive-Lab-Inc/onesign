"use client";

import type { Playlist, PlaylistItemWithMedia } from "@signage/types";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  Layers,
  Monitor,
  Plus,
  Tv,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { LinkScreenDialog } from "@/components/devices/link-screen-dialog";
import { Button } from "@/components/ui/button";
import { PlaylistPreviewButton } from "@/components/playlist-preview";
import { getDeviceDisplayDimensionsPx } from "@/components/device-telemetry-panel";
import type { ActiveAppRelease } from "@/hooks/use-active-app-release";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import {
  buildDashboardDeviceRows,
  summarizeFleetAttention,
  type DashboardDeviceRow,
  type DeviceHealthKind,
} from "@/lib/dashboard-device-health";
import { normalizeDeviceScreenOrientation } from "@/lib/device-screen-orientation";
import { getMediaPublicBaseUrl, mediaPublicUrl } from "@/lib/object-storage/urls";
import { deviceLiveScreenshotObjectPath } from "@/lib/upload-device-live-screenshot";
import { cn } from "@/lib/utils";

const fleetThClass =
  "whitespace-nowrap px-4 py-2.5 text-left text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground";
const fleetPreviewColClass =
  "w-[6.25rem] border-r border-border/80 bg-muted/20 px-3 py-3 align-middle";
const fleetTdClass = "px-4 py-3 align-middle";

const healthStyles: Record<
  DeviceHealthKind,
  { chip: string; dot: string; pulse?: boolean }
> = {
  playing: {
    chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  idle: {
    chip: "border-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    dot: "bg-sky-500",
  },
  offline: {
    chip: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
    dot: "bg-red-500",
    pulse: true,
  },
  offline_expected: {
    chip: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  off_hours: {
    chip: "border-violet-500/25 bg-violet-500/10 text-violet-900 dark:text-violet-100",
    dot: "bg-violet-500",
  },
  pending: {
    chip: "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    dot: "bg-amber-500",
  },
  paused: {
    chip: "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200",
    dot: "bg-red-500",
  },
  disabled: {
    chip: "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    dot: "bg-amber-500",
  },
  suspended: {
    chip: "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200",
    dot: "bg-red-500",
  },
};

function HealthChip({ row }: { row: DashboardDeviceRow }) {
  const styles = healthStyles[row.health];
  const live = row.health === "playing";
  const isOffline = row.health === "offline";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[0.75rem] font-semibold",
        styles.chip,
      )}
      title={row.healthDetail ?? undefined}
    >
      <span className="relative flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden>
        {live ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-35" />
        ) : null}
        {styles.pulse && isOffline ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-35" />
        ) : null}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", styles.dot)} />
      </span>
      <span className="truncate">{row.healthLabel}</span>
    </span>
  );
}

function ScreenPreview({
  row,
  ownerId,
}: {
  row: DashboardDeviceRow;
  ownerId: string | null;
}) {
  const device = row.device;
  const thumbnailUrl = device.thumbnail_storage_path
    ? mediaPublicUrl(device.thumbnail_storage_path)
    : null;
  const livePath =
    ownerId != null ? deviceLiveScreenshotObjectPath(ownerId, device.id) : null;
  const liveUrl =
    livePath && device.live_screenshot_at
      ? `${mediaPublicUrl(livePath)}?v=${encodeURIComponent(device.live_screenshot_at)}`
      : null;
  const imageUrl = liveUrl ?? thumbnailUrl;

  return (
    <div className="flex justify-center">
      <div className="relative aspect-[16/10] w-full max-w-[5.25rem] overflow-hidden rounded-lg border border-border/80 bg-muted/40">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill className="object-cover" sizes="84px" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
            <Tv className="h-5 w-5" strokeWidth={1.35} aria-hidden />
          </div>
        )}
        {row.previewImageKind === "live" ? (
          <span className="absolute left-1 top-1 rounded bg-foreground/75 px-1 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-background">
            Live
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AssignmentBadge({ row }: { row: DashboardDeviceRow }) {
  if (row.assignmentSource === "none") {
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
        Unassigned
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium",
        row.assignmentSource === "group"
          ? "bg-brand-soft text-brand-strong"
          : "bg-muted text-muted-foreground",
      )}
    >
      {row.assignmentSource === "group" ? (
        <Layers className="h-3 w-3" strokeWidth={2} aria-hidden />
      ) : (
        <Monitor className="h-3 w-3" strokeWidth={2} aria-hidden />
      )}
      {row.assignmentSource === "group" ? "Group" : "Screen"}
    </span>
  );
}

function RowPlaylistPreview({
  row,
  playlistItemsByPlaylistId,
}: {
  row: DashboardDeviceRow;
  playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
}) {
  if (!row.playlistId || !getMediaPublicBaseUrl()) {
    return <span className="text-[0.6875rem] text-muted-foreground">—</span>;
  }

  const items = playlistItemsByPlaylistId[row.playlistId] ?? [];
  const frame = {
    kind: "device" as const,
    displayPx: getDeviceDisplayDimensionsPx(row.device),
    orientation: normalizeDeviceScreenOrientation(row.device.screen_orientation),
  };

  return (
    <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <PlaylistPreviewButton
        items={items}
        playlistName={row.playlistName}
        frame={frame}
        label="View"
        icon={Eye}
        className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
      />
    </span>
  );
}

function AttentionBanner({
  summary,
  rowCount,
}: {
  summary: ReturnType<typeof summarizeFleetAttention>;
  rowCount: number;
}) {
  if (summary.allHealthy) {
    return (
      <div className="flex items-center gap-3 border-b border-border/80 bg-muted/20 px-5 py-4 sm:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">All screens look healthy</p>
          <p className="text-xs text-muted-foreground">
            {summary.playing} playing · {rowCount} linked · {summary.inGroups} in groups
          </p>
        </div>
      </div>
    );
  }

  const topIssues = summary.needsAttention.slice(0, 3);

  return (
    <div className="border-b border-border/80 bg-amber-500/5 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {summary.needsAttention.length} screen{summary.needsAttention.length === 1 ? "" : "s"} need attention
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {summary.offlineUnexpected > 0
                ? `${summary.offlineUnexpected} unreachable during active hours`
                : "Review playback, content, or app status below"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {topIssues.map((row) => (
            <span
              key={row.device.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1 text-xs text-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
              {row.device.name}
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{row.attentionIssues[0]?.label ?? row.healthLabel}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeviceFleetRow({
  row,
  ownerId,
  playlistItemsByPlaylistId,
  onOpen,
}: {
  row: DashboardDeviceRow;
  ownerId: string | null;
  playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
  onOpen: (deviceId: string) => void;
}) {
  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={() => onOpen(row.device.public_code)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(row.device.public_code);
        }
      }}
      className="group cursor-pointer border-b border-border/80 transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-faint30"
    >
      <td className={fleetPreviewColClass}>
        <ScreenPreview row={row} ownerId={ownerId} />
      </td>

      <td className={fleetTdClass}>
        <p className="truncate font-bold text-foreground">{row.device.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {row.groupName ? (
            <span className="truncate text-[0.6875rem] text-muted-foreground">{row.groupName}</span>
          ) : null}
          <AssignmentBadge row={row} />
          {row.appVersionLabel ? (
            <span className="text-[0.625rem] tabular-nums text-muted-foreground">{row.appVersionLabel}</span>
          ) : null}
        </div>
      </td>

      <td className={fleetTdClass}>
        <HealthChip row={row} />
      </td>

      <td className={fleetTdClass}>
        <RowPlaylistPreview row={row} playlistItemsByPlaylistId={playlistItemsByPlaylistId} />
      </td>

      <td className={cn(fleetTdClass, "text-right")}>
        <span className="text-[0.6875rem] tabular-nums text-muted-foreground">{row.lastSeenLabel}</span>
      </td>

      <td className="w-10 px-2 py-3 align-middle">
        <ChevronRight
          className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground"
          aria-hidden
        />
      </td>
    </tr>
  );
}

export function PairedDevicesSection({
  devices,
  deviceGroups,
  playlists,
  playlistItemsByPlaylistId,
  activeAppRelease,
  ownerId,
}: {
  devices: DeviceWithAssignments[];
  deviceGroups: DeviceGroupWithMembers[];
  playlists: Playlist[];
  playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
  activeAppRelease: ActiveAppRelease | null;
  ownerId: string | null;
}) {
  const router = useRouter();
  const plan = usePlanQuota();
  const { syncNow } = useConsoleSync();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const refreshAfterMutation = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  const rows = useMemo(
    () =>
      buildDashboardDeviceRows(devices, {
        deviceGroups,
        playlists,
        playlistItemsByPlaylistId,
        activeAppRelease,
      }),
    [devices, deviceGroups, playlists, playlistItemsByPlaylistId, activeAppRelease],
  );

  const summary = useMemo(() => summarizeFleetAttention(rows), [rows]);
  const onlineCount = rows.filter((row) => row.status === "online").length;

  return (
    <>
    <section className="space-y-3" aria-label="Screen fleet">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Fleet monitor
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Your screens</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/80 bg-card px-3 py-1 text-[0.6875rem] font-semibold tabular-nums text-foreground">
            {rows.length} linked
          </span>
          <span
            className={cn(
              "rounded-full border border-border/80 bg-card px-3 py-1 text-[0.6875rem] font-semibold tabular-nums",
              onlineCount > 0 ? "text-[var(--dashboard-brand)]" : "text-muted-foreground",
            )}
          >
            <span className={onlineCount === 0 ? "text-red-600 dark:text-red-400" : undefined}>
              {onlineCount}
            </span>{" "}
            online
          </span>
          <span className="rounded-full border border-border/80 bg-card px-3 py-1 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
            {summary.inGroups} grouped
          </span>
          <Link
            href="/screens"
            className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card px-3 py-1 text-[0.6875rem] font-semibold text-foreground transition hover:bg-muted/50"
          >
            Manage
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Tv className="h-6 w-6" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">No paired screens yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Link a TV player to start monitoring playback from here.
          </p>
          <Button type="button" className="mt-4 gap-2" onClick={() => setLinkDialogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Link screen
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <AttentionBanner summary={summary} rowCount={rows.length} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead className="border-b border-border/80 bg-muted/30">
                <tr>
                  <th className={cn(fleetThClass, fleetPreviewColClass, "text-center")}>Preview</th>
                  <th className={fleetThClass}>Screen</th>
                  <th className={fleetThClass}>Health</th>
                  <th className={fleetThClass}>Playlist</th>
                  <th className={cn(fleetThClass, "text-right")}>Last seen</th>
                  <th className="w-10 px-2 py-2.5" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <DeviceFleetRow
                    key={row.device.id}
                    row={row}
                    ownerId={ownerId}
                    playlistItemsByPlaylistId={playlistItemsByPlaylistId}
                    onOpen={(deviceId) => router.push(`/screens/${deviceId}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>

      <LinkScreenDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        deviceCount={devices.length}
        deviceLimit={plan?.deviceLimit ?? null}
        onLinked={refreshAfterMutation}
      />
    </>
  );
}
