"use client";

import type { Playlist, PlaylistItemWithMedia } from "@signage/types";
import { useMemo } from "react";
import { DashboardStatsSection } from "@/components/dashboard/dashboard-stats-section";
import { PairedDevicesSection } from "@/components/dashboard/paired-devices-section";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import { useActiveAppRelease } from "@/hooks/use-active-app-release";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { effectiveDeviceStatus } from "@/lib/device-status";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { TrialHomeCard } from "@/components/console/trial-status";

export default function DashboardHomePage() {
  useStaleOnlineTick();

  const plan = usePlanQuota();
  const activeAppRelease = useActiveAppRelease();
  const storeDeviceCount = useConsoleDataStore((s) => s.devices.length);
  const ownerId = useConsoleOwnerId();
  const mediaCount = useConsoleDataStore((s) => s.media.length);
  const devices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];
  const deviceGroups = useConsoleDataStore((s) => s.deviceGroups);
  const playlists = useConsoleDataStore((s) => s.playlists) as Playlist[];
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);

  const ready = useMemo(() => ownerId != null, [ownerId]);

  const onlineDeviceCount = devices.filter((d) => effectiveDeviceStatus(d) === "online").length;

  if (!ready) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-xl bg-muted/50" />
      </div>
    );
  }

  return (
    <div className="dashboard-home space-y-8">
      <TrialHomeCard />

      <DashboardStatsSection
        deviceCount={storeDeviceCount}
        deviceLimit={plan?.deviceLimit ?? storeDeviceCount}
        storageUsedBytes={plan?.storageUsedBytes ?? 0}
        storageLimitBytes={plan?.storageLimitBytes ?? 0}
        onlineCount={onlineDeviceCount}
        mediaCount={mediaCount}
        showPlanUsage={plan != null}
      />

      <PairedDevicesSection
        devices={devices}
        deviceGroups={deviceGroups}
        playlists={playlists}
        playlistItemsByPlaylistId={playlistItemsByPlaylistId}
        activeAppRelease={activeAppRelease}
        ownerId={ownerId}
      />
    </div>
  );
}
