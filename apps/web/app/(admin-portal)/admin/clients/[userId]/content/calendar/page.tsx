"use client";

import type { Playlist, PlaylistItemWithMedia } from "@signage/types";
import { Suspense } from "react";
import { devicesListPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { ContentViewTabs } from "@/components/content/content-view-tabs";
import { ScheduleCalendarView } from "@/components/schedule/schedule-calendar-view";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { useConsoleDataStore } from "@/stores/console-data-store";

function AdminClientCalendarPageContent() {
  const ownerId = useConsoleOwnerId();
  const adminRoutes = useAdminClientRoutes();
  const playlists = useConsoleDataStore((s) => s.playlists) as Playlist[];
  const playlistItemsByPlaylistId = useConsoleDataStore(
    (s) => s.playlistItemsByPlaylistId,
  ) as Record<string, PlaylistItemWithMedia[]>;
  const devices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];

  if (!ownerId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ContentViewTabs activeView="calendar" />
      <ScheduleCalendarView
        playlists={playlists}
        playlistItemsByPlaylistId={playlistItemsByPlaylistId}
        devices={devices}
        screensPath={devicesListPath(adminRoutes)}
      />
    </div>
  );
}

export default function AdminClientContentCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted/60" />
        </div>
      }
    >
      <AdminClientCalendarPageContent />
    </Suspense>
  );
}
