"use client";

import type { PlaylistTransitionStyle } from "@signage/types";
import { AlertTriangle, Plus, Settings2, Tv } from "lucide-react";
import { notFound } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { groupsListPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import { effectiveDeviceStatus } from "@/lib/device-status";
import { resolveGroupColor } from "@/lib/device-group-colors";
import { getMediaPublicBaseUrl } from "@/lib/object-storage/urls";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { ScreenPlaylistWorkspace } from "@/components/devices/screen-playlist-workspace";
import { PlaylistTransitionsDialog } from "@/components/devices/playlist-transitions-dialog";
import { isStorageFull } from "@/lib/plan-quota";
import { syncGroupPlaylistToMembers } from "@/lib/group-playlist";
import { DeviceGroupEditorDialog } from "@/components/device-groups/device-group-editor-dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";

type DeviceGroupScreenEditorProps = {
  groupId: string;
  ownerId: string;
  canManagePlaylist?: boolean;
};

export function DeviceGroupScreenEditor({
  groupId,
  ownerId,
  canManagePlaylist = true,
}: DeviceGroupScreenEditorProps) {
  useStaleOnlineTick();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const adminRoutes = useAdminClientRoutes();
  const { syncNow } = useConsoleSync();
  const plan = usePlanQuota();
  const storageFull = plan != null && isStorageFull(plan);

  const deviceGroups = useConsoleDataStore((s) => s.deviceGroups) as DeviceGroupWithMembers[];
  const devices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];
  const playlists = useConsoleDataStore((s) => s.playlists);
  const lastSyncedAt = useConsoleDataStore((s) => s.lastSyncedAt);

  const group = useMemo(
    () => deviceGroups.find((entry) => entry.id === groupId) ?? null,
    [deviceGroups, groupId],
  );

  const memberDevices = useMemo(() => {
    if (!group) return [];
    return group.member_device_ids
      .map((id) => devices.find((device) => device.id === id))
      .filter((device): device is DeviceWithAssignments => device != null);
  }, [devices, group]);

  const onlineCount = useMemo(
    () => memberDevices.filter((device) => effectiveDeviceStatus(device) === "online").length,
    [memberDevices],
  );

  const playlistId = group?.playlist_id ?? "";
  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === playlistId) ?? null,
    [playlists, playlistId],
  );
  const transitionStyle: PlaylistTransitionStyle = activePlaylist?.transition_style ?? "none";
  const shuffleEnabled = activePlaylist?.shuffle_enabled ?? false;

  const [transitionsDialogOpen, setTransitionsDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void syncNow();
  }, [groupId, syncNow]);

  const reloadFromServer = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  const groupReady = group != null;

  useEffect(() => {
    if (!groupReady || !group || !canManagePlaylist) return;
    void (async () => {
      const { playlistId: ensured, error } = await syncGroupPlaylistToMembers(supabase, ownerId, group);
      if (error) {
        toast.error(error);
        return;
      }
      if (ensured && ensured !== group.playlist_id) {
        useConsoleDataStore.setState((state) => ({
          deviceGroups: state.deviceGroups.map((entry) =>
            entry.id === group.id ? { ...entry, playlist_id: ensured } : entry,
          ),
        }));
      }
      await reloadFromServer();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groupId + groupReady scope the initial sync
  }, [groupId, groupReady, canManagePlaylist, ownerId]);

  const handleSavePlaylistSettings = useCallback(
    async (values: { transitionStyle: PlaylistTransitionStyle; shuffleEnabled: boolean }) => {
      if (!playlistId) return;
      const { error } = await supabase
        .from("playlists")
        .update({
          transition_style: values.transitionStyle,
          shuffle_enabled: values.shuffleEnabled,
        })
        .eq("id", playlistId);
      if (error) {
        toast.error(error.message);
        throw error;
      }
      toast.success("Playback settings saved");
      await reloadFromServer();
    },
    [playlistId, reloadFromServer, supabase],
  );

  if (!group) {
    if (lastSyncedAt !== null) notFound();
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (!getMediaPublicBaseUrl()) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Missing NEXT_PUBLIC_MEDIA_BASE_URL. Copy `apps/web/.env.example` to `.env.local` to preview thumbnails.
      </div>
    );
  }

  const groupColor = resolveGroupColor(group.accent_color);
  const memberStatus =
    memberDevices.length === 0
      ? "No screens in this group"
      : `${memberDevices.length} screen${memberDevices.length === 1 ? "" : "s"}${onlineCount > 0 ? ` · ${onlineCount} online` : ""}`;

  return (
    <div className="space-y-6">
      <BackNavLink href={groupsListPath(adminRoutes)} label="Back to groups" />

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40"
              style={{ color: groupColor }}
              aria-hidden
            >
              <Tv className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{group.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{memberStatus}</p>
              {memberDevices.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  All screens in this group play the same playlist below.
                </p>
              ) : null}
            </div>
          </div>

          {canManagePlaylist ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Assign screens
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" aria-hidden />
                Settings
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {playlistId ? (
        <div className="space-y-3">
          {memberDevices.length > 0 ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-orange-500/15 px-4 py-3.5 text-sm text-amber-950 shadow-sm dark:border-amber-400/40 dark:from-amber-500/25 dark:via-amber-500/12 dark:to-orange-500/15 dark:text-amber-50"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="leading-relaxed">
                This is the shared playlist for group{" "}
                <span className="font-semibold text-amber-900 dark:text-amber-100">{group.name}</span>. Changes here
                apply to all screens in that group.
              </p>
            </div>
          ) : null}

          <ScreenPlaylistWorkspace
            playlistName={group.name}
            ownerId={ownerId}
            playlistId={playlistId}
            canManage={canManagePlaylist}
            storageFull={storageFull}
            previewFrame={{ kind: "playlist" }}
            onOpenTransitions={() => setTransitionsDialogOpen(true)}
          />
        </div>
      ) : canManagePlaylist ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-12 text-center text-sm text-muted-foreground">
          Preparing group playlist…
        </div>
      ) : null}

      <PlaylistTransitionsDialog
        open={transitionsDialogOpen}
        onClose={() => setTransitionsDialogOpen(false)}
        transitionStyle={transitionStyle}
        shuffleEnabled={shuffleEnabled}
        onSave={handleSavePlaylistSettings}
      />

      <DeviceGroupEditorDialog
        open={settingsOpen}
        mode="edit"
        ownerId={ownerId}
        group={group}
        devices={devices}
        onClose={() => {
          setSettingsOpen(false);
          void syncNow();
        }}
      />
    </div>
  );
}
