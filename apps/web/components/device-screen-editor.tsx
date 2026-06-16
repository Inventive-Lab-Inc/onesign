"use client";

import type { PlaylistTransitionStyle } from "@signage/types";
import { Info } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { devicesListPath, groupDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import { effectiveDeviceStatus, formatDeviceLastSeen } from "@/lib/device-status";
import { getMediaPublicBaseUrl } from "@/lib/object-storage/urls";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { DeviceDisabledNotice, deviceDisabledPresentation } from "@/components/device-disabled-notice";
import { DeviceDetailsDrawer } from "@/components/devices/device-details-drawer";
import { DeviceSettingsDrawerButton } from "@/components/devices/device-settings-drawer";
import { DeviceHoursButton } from "@/components/devices/device-operating-hours-dialog";
import { DeviceScreenOrientationIcon } from "@/components/devices/device-screen-orientation-icon";
import { ScreenPlaylistWorkspace } from "@/components/devices/screen-playlist-workspace";
import {
  deviceScreenBasics,
  getDeviceDisplayDimensionsPx,
} from "@/components/device-telemetry-panel";
import { DeviceAppUpdateNotice, DeviceAppVersionChip } from "@/components/device-app-version-chip";
import { DeviceMediaCacheChip } from "@/components/device-media-cache-chip";
import { useActiveAppRelease } from "@/hooks/use-active-app-release";
import { CopyPlaylistToScreensDialog } from "@/components/devices/copy-playlist-to-screens-dialog";
import { DeviceThumbnailPicker } from "@/components/devices/device-thumbnail-picker";
import { PlaylistTransitionsDialog } from "@/components/devices/playlist-transitions-dialog";
import { copyPlaylistToDevices } from "@/lib/copy-device-playlist";
import { isStorageFull } from "@/lib/plan-quota";
import { groupFilterLabel, parseGroupFilterFromSearchParam } from "@/lib/device-group-navigation";
import { ensureActivePlaylistForDevice } from "@/lib/screen-playlist";
import { resolveDeviceScreenTimezone } from "@/lib/screen-timezone";
import { detectBrowserTimezone } from "@/lib/weekly-schedule";
import {
  formatDeviceScreenOrientationSubtitle,
  normalizeDeviceScreenOrientation,
} from "@/lib/device-screen-orientation";
import { DevicePlaybackToggle } from "@/components/device-playback-toggle";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";

interface DeviceScreenEditorProps {
  deviceId: string;
  ownerId: string;
  canManageTvPlaylist?: boolean;
  canControlPlayback?: boolean;
}

export function DeviceScreenEditor({
  deviceId,
  ownerId,
  canManageTvPlaylist = true,
  canControlPlayback = false,
}: DeviceScreenEditorProps) {
  useStaleOnlineTick();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const adminRoutes = useAdminClientRoutes();
  const deviceGroups = useConsoleDataStore((s) => s.deviceGroups);
  const { syncNow } = useConsoleSync();
  const activeAppRelease = useActiveAppRelease();
  const plan = usePlanQuota();
  const accountDisabled = plan?.accountDisabled ?? false;

  const storeDevices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];
  const patchDevice = useConsoleDataStore((s) => s.patchDevice);
  const device = useMemo(
    () => storeDevices.find((d) => d.id === deviceId),
    [storeDevices, deviceId],
  );
  const disabledState = device ? deviceDisabledPresentation(device, accountDisabled) : null;
  const deviceDisabled = disabledState?.show ?? false;

  const returnGroupId = useMemo(
    () => parseGroupFilterFromSearchParam(searchParams.get("group"), deviceGroups),
    [searchParams, deviceGroups],
  );
  const returnGroup = useMemo(
    () =>
      returnGroupId !== "all" && returnGroupId !== "ungrouped"
        ? (deviceGroups.find((group) => group.id === returnGroupId) ?? null)
        : null,
    [deviceGroups, returnGroupId],
  );
  const screensBackHref = devicesListPath(adminRoutes, returnGroupId === "all" ? null : returnGroupId);
  const screensBackLabel =
    returnGroupId === "all"
      ? "Back to screens"
      : `Back to ${groupFilterLabel(returnGroupId, returnGroup)}`;

  useEffect(() => {
    void syncNow();
  }, [deviceId, syncNow]);

  const activePlaylistId = useMemo(() => {
    return device?.device_playlists?.find((row) => row.is_active)?.playlist_id ?? "";
  }, [device]);

  const playlistId = activePlaylistId;

  const playlists = useConsoleDataStore((s) => s.playlists);
  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === playlistId) ?? null,
    [playlists, playlistId],
  );
  const transitionStyle: PlaylistTransitionStyle = activePlaylist?.transition_style ?? "none";
  const shuffleEnabled = activePlaylist?.shuffle_enabled ?? false;
  const storageFull = plan != null && isStorageFull(plan);

  const cachedItems = useConsoleDataStore((s) =>
    playlistId ? (s.playlistItemsByPlaylistId[playlistId] ?? []) : [],
  );

  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [transitionsDialogOpen, setTransitionsDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const reloadFromServer = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  useEffect(() => {
    if (!device || !canManageTvPlaylist || activePlaylistId) return;
    void (async () => {
      const { error } = await ensureActivePlaylistForDevice(supabase, ownerId, device);
      if (error) toast.error(error);
      else await reloadFromServer();
    })();
  }, [activePlaylistId, canManageTvPlaylist, device, ownerId, reloadFromServer, supabase]);

  const otherDevices = useMemo(
    () => storeDevices.filter((entry) => entry.id !== deviceId),
    [storeDevices, deviceId],
  );

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

  const handleCopyToScreens = useCallback(
    async (targetDeviceIds: string[]) => {
      if (!device) return;
      const targets = otherDevices.filter((entry) => targetDeviceIds.includes(entry.id));
      const { copiedCount, error } = await copyPlaylistToDevices(supabase, ownerId, cachedItems, targets);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(`Playlist copied to ${copiedCount} screen${copiedCount === 1 ? "" : "s"}`);
      await reloadFromServer();
    },
    [cachedItems, device, otherDevices, ownerId, reloadFromServer, supabase],
  );

  const deviceDisplayPxForPreview = useMemo(
    () => (device ? getDeviceDisplayDimensionsPx(device) : null),
    [device],
  );

  const screenHardwareBasics = useMemo(
    () => (device ? deviceScreenBasics(device) : { brand: null, model: null, screenSize: null }),
    [device],
  );

  const screenOrientation = normalizeDeviceScreenOrientation(device?.screen_orientation);

  const lastPlaylistChangeAt = useMemo(() => {
    const active = device?.device_playlists?.find((row) => row.is_active);
    return active?.updated_at ?? null;
  }, [device?.device_playlists]);

  const sharedGroupPlaylist = useMemo(() => {
    if (!activePlaylistId) return null;
    return deviceGroups.find((group) => group.playlist_id === activePlaylistId) ?? null;
  }, [activePlaylistId, deviceGroups]);

  const screenTimezone = useMemo(
    () => (device ? resolveDeviceScreenTimezone(device) : detectBrowserTimezone()),
    [device],
  );

  if (!device) {
    return null;
  }

  if (!getMediaPublicBaseUrl()) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Missing NEXT_PUBLIC_MEDIA_BASE_URL. Copy `apps/web/.env.example` to `.env.local` to preview thumbnails.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <BackNavLink href={screensBackHref} label={screensBackLabel} />
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="text-foreground">Screens</span>
          {returnGroup ? (
            <>
              <span className="text-muted-foreground/70">/</span>
              <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">
                {returnGroup.name}
              </span>
            </>
          ) : null}
          <span className="text-muted-foreground/70">/</span>
          <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">
            {device.name}
          </span>
        </div>
      </div>

      {deviceDisabled ? (
        <DeviceDisabledNotice
          canControlPlayback={canControlPlayback}
          accountSuspended={disabledState?.accountSuspended}
          pausedByQuota={disabledState?.pausedByQuota}
        />
      ) : null}

      {sharedGroupPlaylist ? (
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 px-4 py-3 text-sm text-foreground">
          This screen plays the shared playlist for group{" "}
          <Link
            href={groupDetailPath(sharedGroupPlaylist.id, adminRoutes)}
            className="font-semibold text-brand-badge underline-offset-2 hover:underline dark:text-brand-onDarkSoft"
          >
            {sharedGroupPlaylist.name}
          </Link>
          . Changes here apply to all screens in that group.
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <DeviceThumbnailPicker
            deviceId={device.id}
            ownerId={ownerId}
            thumbnailStoragePath={device.thumbnail_storage_path}
            status={effectiveDeviceStatus(device)}
            canEdit={canManageTvPlaylist}
            onUpdated={(thumbnailStoragePath) =>
              patchDevice(device.id, { thumbnail_storage_path: thumbnailStoragePath })
            }
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <h1 className="min-w-0 w-fit max-w-full text-balance text-2xl font-semibold tracking-tight text-foreground leading-snug">
                <span className="break-words [overflow-wrap:anywhere]">{device.name}</span>
              </h1>
              {device.description ? (
                <p className="max-w-2xl text-sm text-muted-foreground">{device.description}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{formatDeviceLastSeen(device.last_seen)}</span>
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
                Details
              </button>
            </div>

            <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <DeviceScreenOrientationIcon orientation={screenOrientation} className="h-4 w-4" />
              <span>{formatDeviceScreenOrientationSubtitle(screenOrientation)}</span>
            </div>

            <div className="space-y-1">
              <div
                className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="list"
                aria-label="Device status"
              >
                <DeviceAppVersionChip device={device} activeRelease={activeAppRelease} />
                <DeviceMediaCacheChip device={device} />
              </div>
              {(screenHardwareBasics.brand || screenHardwareBasics.model || screenHardwareBasics.screenSize) && (
                <div
                  className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="list"
                  aria-label="Device hardware from TV telemetry"
                >
                  {screenHardwareBasics.brand ? (
                    <span
                      role="listitem"
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-muted/35 px-2.5 py-0.5 text-[0.6875rem] leading-tight"
                    >
                      <span className="shrink-0 text-muted-foreground">Brand</span>
                      <span className="min-w-0 truncate font-medium text-foreground">{screenHardwareBasics.brand}</span>
                    </span>
                  ) : null}
                  {screenHardwareBasics.model ? (
                    <span
                      role="listitem"
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-muted/35 px-2.5 py-0.5 text-[0.6875rem] leading-tight"
                    >
                      <span className="shrink-0 text-muted-foreground">Model</span>
                      <span className="min-w-0 truncate font-medium text-foreground">{screenHardwareBasics.model}</span>
                    </span>
                  ) : null}
                  {screenHardwareBasics.screenSize ? (
                    <span
                      role="listitem"
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-muted/35 px-2.5 py-0.5 text-[0.6875rem] leading-tight tabular-nums"
                    >
                      <span className="shrink-0 text-muted-foreground">Screen</span>
                      <span className="min-w-0 truncate font-medium text-foreground">{screenHardwareBasics.screenSize}</span>
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-wrap justify-start gap-2 border-t border-border pt-6 lg:w-auto lg:self-center lg:justify-end lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {canControlPlayback ? <DevicePlaybackToggle device={device} /> : null}
            {canManageTvPlaylist ? <DeviceHoursButton device={device} canEdit={canManageTvPlaylist} /> : null}
            <DeviceSettingsDrawerButton device={device} canEdit={canManageTvPlaylist} />
          </div>
        </div>
      </div>

      <DeviceAppUpdateNotice device={device} activeRelease={activeAppRelease} />

      {playlistId ? (
        <ScreenPlaylistWorkspace
          playlistName={device.name}
          screenTimezone={screenTimezone}
          ownerId={ownerId}
          playlistId={playlistId}
          canManage={canManageTvPlaylist}
          storageFull={storageFull}
          previewFrame={{ kind: "device", displayPx: deviceDisplayPxForPreview }}
          onCopyToScreens={() => setCopyDialogOpen(true)}
          onOpenTransitions={() => setTransitionsDialogOpen(true)}
          otherDeviceCount={otherDevices.length}
        />
      ) : canManageTvPlaylist ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-12 text-center text-sm text-muted-foreground">
          Preparing playlist for this screen…
        </div>
      ) : null}

      <CopyPlaylistToScreensDialog
        open={copyDialogOpen}
        onClose={() => setCopyDialogOpen(false)}
        sourceDeviceName={device.name}
        devices={otherDevices}
        onConfirm={handleCopyToScreens}
      />

      <PlaylistTransitionsDialog
        open={transitionsDialogOpen}
        onClose={() => setTransitionsDialogOpen(false)}
        transitionStyle={transitionStyle}
        shuffleEnabled={shuffleEnabled}
        onSave={handleSavePlaylistSettings}
      />

      <DeviceDetailsDrawer
        device={device}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        lastPlaylistChangeAt={lastPlaylistChangeAt}
      />
    </div>
  );
}
