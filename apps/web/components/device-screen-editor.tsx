"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { Media, PlaylistItemWithMedia, PlaylistTransitionStyle } from "@signage/types";
import {
  ArrowDown,
  Copy,
  FileImage,
  FileVideo,
  GripVertical,
  Image as ImageIcon,
  Info,
  Shuffle,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { BackNavLink } from "@/components/back-nav-link";
import { devicesListPath, groupDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import { effectiveDeviceStatus, formatDeviceLastSeen } from "@/lib/device-status";
import { ensureMediaVideoDuration } from "@/lib/media";
import { getMediaPublicBaseUrl, mediaPublicUrl } from "@/lib/object-storage/urls";
import { buildPlaylistItemInsertRow, formatPlaylistClockLabel } from "@/lib/playlist-timing";
import { cn } from "@/lib/utils";
import { PlaylistAssetsPanel } from "@/components/playlist-assets-panel";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { DevicePlaybackToggle } from "@/components/device-playback-toggle";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { DeviceDisabledNotice, deviceDisabledPresentation } from "@/components/device-disabled-notice";
import { DeviceDetailsDrawer } from "@/components/devices/device-details-drawer";
import { DeviceSettingsDrawerButton } from "@/components/devices/device-settings-drawer";
import { DeviceScreenOrientationIcon } from "@/components/devices/device-screen-orientation-icon";
import { PlaylistPreviewButton } from "@/components/playlist-preview";
import { ReadonlyVideoDuration } from "@/components/readonly-video-duration";
import { useEnsurePlaylistVideoDurations } from "@/hooks/use-ensure-playlist-video-durations";
import {
  deviceScreenBasics,
  getDeviceDisplayDimensionsPx,
} from "@/components/device-telemetry-panel";
import { DeviceAppUpdateNotice, DeviceAppVersionChip } from "@/components/device-app-version-chip";
import { DeviceMediaCacheChip } from "@/components/device-media-cache-chip";
import { useActiveAppRelease } from "@/hooks/use-active-app-release";
import { ItemActionMenu } from "@/components/console/item-action-menu";
import { CopyPlaylistToScreensDialog } from "@/components/devices/copy-playlist-to-screens-dialog";
import { DeviceThumbnailPicker } from "@/components/devices/device-thumbnail-picker";
import { PlaylistTransitionsDialog } from "@/components/devices/playlist-transitions-dialog";
import { clearDevicePlaylist, copyPlaylistToDevices } from "@/lib/copy-device-playlist";
import { isStorageFull } from "@/lib/plan-quota";
import { groupFilterLabel, parseGroupFilterFromSearchParam } from "@/lib/device-group-navigation";
import { ensureActivePlaylistForDevice } from "@/lib/screen-playlist";
import {
  formatDeviceScreenOrientationSubtitle,
  normalizeDeviceScreenOrientation,
} from "@/lib/device-screen-orientation";

/** Stable fallback so Zustand selectors don’t return a new [] every run (avoids render loops). */
const EMPTY_PLAYLIST_ITEMS: PlaylistItemWithMedia[] = [];

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  if (!removed) return list;
  result.splice(endIndex, 0, removed);
  return result;
}

interface DeviceScreenEditorProps {
  deviceId: string;
  ownerId: string;
  /** Playlist picker, assignment, and clip editor. */
  canManageTvPlaylist?: boolean;
  /** Pause/resume TV playback — platform admins only (RLS-enforced). */
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
    () => (returnGroupId !== "all" && returnGroupId !== "ungrouped"
      ? deviceGroups.find((group) => group.id === returnGroupId) ?? null
      : null),
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

  const allMedia = useConsoleDataStore((s) => s.media) as Media[];

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

  const deviceDisplayPxForPreview = useMemo(
    () => (device ? getDeviceDisplayDimensionsPx(device) : null),
    [device],
  );
  const cachedItems = useConsoleDataStore((s) =>
    playlistId
      ? (s.playlistItemsByPlaylistId[playlistId] ?? EMPTY_PLAYLIST_ITEMS)
      : EMPTY_PLAYLIST_ITEMS,
  );
  const [items, setItems] = useState<PlaylistItemWithMedia[]>(cachedItems);
  const [libraryResetKey, setLibraryResetKey] = useState(0);
  const [librarySearch, setLibrarySearch] = useState("");
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [transitionsDialogOpen, setTransitionsDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setItems(cachedItems);
  }, [cachedItems]);

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

  useEnsurePlaylistVideoDurations(items, supabase, reloadFromServer);

  const resolvePlaylistId = useCallback(async (): Promise<string | null> => {
    if (!device) return null;
    if (playlistId) return playlistId;
    const { playlistId: ensured, error } = await ensureActivePlaylistForDevice(supabase, ownerId, device);
    if (error || !ensured) {
      toast.error(error ?? "Unable to prepare playlist for this screen");
      return null;
    }
    await reloadFromServer();
    return ensured;
  }, [device, ownerId, playlistId, reloadFromServer, supabase]);

  const persistOrder = useCallback(
    async (next: PlaylistItemWithMedia[]) => {
      const updates = next.map((item, index) =>
        supabase.from("playlist_items").update({ sort_order: index }).eq("id", item.id),
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        toast.error(failed.error.message);
        await reloadFromServer();
        return;
      }
      await reloadFromServer();
    },
    [reloadFromServer, supabase],
  );

  const removeItem = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("playlist_items").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Removed from playlist");
      await reloadFromServer();
    },
    [reloadFromServer, supabase],
  );

  const updateDuration = useCallback(
    async (id: string, duration: number) => {
      const { error } = await supabase.from("playlist_items").update({ duration_seconds: duration }).eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadFromServer();
    },
    [reloadFromServer, supabase],
  );

  const persistVideoMediaDuration = useCallback(
    async (mediaId: string, seconds: number) => {
      const { error } = await supabase.from("media").update({ duration_seconds: seconds }).eq("id", mediaId);
      if (error) return;
      await reloadFromServer();
    },
    [reloadFromServer, supabase],
  );

  const addMediaAtIndex = useCallback(
    async (mediaId: string, destIndex: number, targetPlaylistId?: string) => {
      const pid = targetPlaylistId ?? playlistId;
      if (!pid) return;
      const sortLen = useConsoleDataStore.getState().playlistItemsByPlaylistId[pid]?.length ?? 0;
      const mediaRow =
        allMedia.find((m) => m.id === mediaId) ??
        (useConsoleDataStore.getState().media as Media[]).find((m) => m.id === mediaId);
      if (mediaRow?.file_type === "video") {
        await ensureMediaVideoDuration(supabase, mediaRow);
      }
      const { data: row, error } = await supabase
        .from("playlist_items")
        .insert(
          buildPlaylistItemInsertRow({
            playlistId: pid,
            mediaId,
            sortOrder: sortLen,
            fileType: mediaRow?.file_type,
          }),
        )
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadFromServer();
      const fresh = useConsoleDataStore.getState().playlistItemsByPlaylistId[pid] ?? [];
      const fromIndex = fresh.findIndex((i) => i.id === row.id);
      if (fromIndex < 0) return;
      if (fromIndex !== destIndex) {
        const reordered = reorder(fresh, fromIndex, destIndex);
        setItems(reordered);
        await persistOrder(reordered);
      } else {
        await persistOrder(fresh);
      }
    },
    [allMedia, persistOrder, playlistId, reloadFromServer, supabase],
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) {
        if (draggableId.startsWith("media-")) setLibraryResetKey((k) => k + 1);
        return;
      }

      if (source.droppableId === "media-library" && destination.droppableId === "media-library") {
        setLibraryResetKey((k) => k + 1);
        return;
      }

      if (draggableId.startsWith("media-") && destination.droppableId === "screen-playlist") {
        const mediaId = draggableId.replace(/^media-/, "");
        const pid = playlistId || (await resolvePlaylistId());
        if (!pid) return;
        await addMediaAtIndex(mediaId, destination.index, pid);
        return;
      }

      if (draggableId.startsWith("pi-") && destination.droppableId === "media-library") {
        const itemId = draggableId.replace(/^pi-/, "");
        await removeItem(itemId);
        setLibraryResetKey((k) => k + 1);
        return;
      }

      if (
        draggableId.startsWith("pi-") &&
        source.droppableId === "screen-playlist" &&
        destination.droppableId === "screen-playlist"
      ) {
        if (destination.index === source.index) return;
        const next = reorder(items, source.index, destination.index);
        setItems(next);
        await persistOrder(next);
      }
    },
    [addMediaAtIndex, items, persistOrder, playlistId, removeItem, resolvePlaylistId],
  );

  const otherDevices = useMemo(
    () => storeDevices.filter((entry) => entry.id !== deviceId),
    [storeDevices, deviceId],
  );

  const handleClearPlaylist = useCallback(async () => {
    if (!playlistId) return;
    const { error } = await clearDevicePlaylist(supabase, playlistId);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Playlist cleared");
    await reloadFromServer();
  }, [playlistId, reloadFromServer, supabase]);

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
      const { copiedCount, error } = await copyPlaylistToDevices(supabase, ownerId, items, targets);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(`Playlist copied to ${copiedCount} screen${copiedCount === 1 ? "" : "s"}`);
      await reloadFromServer();
    },
    [device, items, otherDevices, ownerId, reloadFromServer, supabase],
  );

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return allMedia;
    return allMedia.filter((m) => (m.original_filename ?? m.storage_path).toLowerCase().includes(q));
  }, [allMedia, librarySearch]);

  const screenHardwareBasics = useMemo(
    () => (device ? deviceScreenBasics(device) : { brand: null, model: null, screenSize: null }),
    [device],
  );

  const screenOrientation = normalizeDeviceScreenOrientation(device?.screen_orientation);

  const lastPlaylistChangeAt = useMemo(() => {
    const active = device?.device_playlists?.find((row) => row.is_active);
    return active?.updated_at ?? null;
  }, [device?.device_playlists]);

  const playlistTimingLabel = useMemo(() => formatPlaylistClockLabel(items), [items]);

  const sharedGroupPlaylist = useMemo(() => {
    if (!activePlaylistId) return null;
    return deviceGroups.find((group) => group.playlist_id === activePlaylistId) ?? null;
  }, [activePlaylistId, deviceGroups]);

  const addMediaByClick = useCallback(
    (mediaId: string) => {
      void (async () => {
        const pid = playlistId || (await resolvePlaylistId());
        if (!pid) return;
        const len = useConsoleDataStore.getState().playlistItemsByPlaylistId[pid]?.length ?? items.length;
        await addMediaAtIndex(mediaId, len, pid);
      })();
    },
    [addMediaAtIndex, items.length, playlistId, resolvePlaylistId],
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

  const playlistMenuItems = [
    {
      label: "Playlist transitions",
      onClick: () => setTransitionsDialogOpen(true),
      icon: <Shuffle className="h-3.5 w-3.5" aria-hidden />,
    },
    {
      label: "Copy playlist to other screens",
      onClick: () => setCopyDialogOpen(true),
      icon: <Copy className="h-3.5 w-3.5" aria-hidden />,
      disabled: otherDevices.length === 0,
    },
    {
      label: "Clear playlist",
      onClick: () => void handleClearPlaylist(),
      destructive: true,
      icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
    },
  ];

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
              <DeviceSettingsDrawerButton device={device} canEdit={canManageTvPlaylist} />
            </div>
          </div>
        </div>

      <DeviceAppUpdateNotice device={device} activeRelease={activeAppRelease} />

      {!canManageTvPlaylist ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
          <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-5">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Playlist</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {items.length > 0
                  ? `${items.length} ${items.length === 1 ? "item" : "items"} on this screen (${playlistTimingLabel}). Contact your administrator to change what plays.`
                  : "No content on this screen yet. Your administrator will choose what plays on this TV."}
              </p>
            </div>
          </div>
          {items.length > 0 ? (
            <div className="px-4 py-4 sm:px-5">
              <PlaylistPreviewButton
                items={items}
                playlistName={device.name}
                frame={{ kind: "device", displayPx: deviceDisplayPxForPreview }}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-foreground">Playlist</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {items.length} {items.length === 1 ? "item" : "items"} · {playlistTimingLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PlaylistPreviewButton
                        items={items}
                        playlistName={device.name}
                        frame={{ kind: "device", displayPx: deviceDisplayPxForPreview }}
                      />
                      <ItemActionMenu ariaLabel="Playlist actions" items={playlistMenuItems} />
                    </div>
                  </div>
                </div>

                <div className="p-3 sm:p-4">
                  <Droppable droppableId="screen-playlist">
                    {(dropProvided) => (
                      <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="overflow-x-auto">
                        <div className="min-w-[520px]">
                          {items.length > 0 ? (
                            <div
                              className="grid grid-cols-[40px_88px_1fr_72px_88px_44px] gap-2 border-b border-border pb-2 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground"
                              role="row"
                            >
                              <span className="pl-1">#</span>
                              <span>Thumb</span>
                              <span>Title</span>
                              <span>Type</span>
                              <span>Duration</span>
                              <span className="pr-1 text-right" />
                            </div>
                          ) : null}
                          {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-4 py-16 text-center">
                              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                <ArrowDown className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                              </div>
                              <p className="text-sm font-medium text-foreground">
                                Add content by dragging content from the right to here
                              </p>
                            </div>
                          ) : (
                            items.map((item, index) => (
                              <Draggable key={item.id} draggableId={`pi-${item.id}`} index={index}>
                                {(dragProvided, snapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    role="row"
                                    className={cn(
                                      "border-b border-border/80 py-2.5",
                                      snapshot.isDragging && "rounded-lg bg-brand-softest ring-2 ring-brand-faint25",
                                    )}
                                  >
                                    <div className={cn("grid items-center gap-2", "grid-cols-[40px_88px_1fr_72px_88px_44px]")}>
                                      <div className="flex items-center justify-center pl-1 text-xs tabular-nums text-muted-foreground">
                                        <button
                                          type="button"
                                          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                                          {...dragProvided.dragHandleProps}
                                          aria-label={`Reorder item ${index + 1}`}
                                        >
                                          <GripVertical className="h-4 w-4" />
                                        </button>
                                        <span className="ml-0.5">{index + 1}</span>
                                      </div>
                                      <ScreenPlaylistRowThumb item={item} />
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                          {item.media.original_filename ?? item.media.storage_path}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-muted-foreground">
                                        {item.media.file_type === "video" ? (
                                          <FileVideo className="h-4 w-4 shrink-0" />
                                        ) : (
                                          <ImageIcon className="h-4 w-4 shrink-0" />
                                        )}
                                        <span className="text-xs capitalize">{item.media.file_type}</span>
                                      </div>
                                      <div>
                                        {item.media.file_type === "video" ? (
                                          <ReadonlyVideoDuration
                                            id={`duration-video-${item.id}`}
                                            durationSeconds={item.media.duration_seconds}
                                            fallbackProbeUrl={mediaPublicUrl(item.media.storage_path)}
                                            onProbedDuration={(sec) =>
                                              void persistVideoMediaDuration(item.media.id, sec)
                                            }
                                          />
                                        ) : (
                                          <>
                                            <Label className="sr-only" htmlFor={`dur-${item.id}`}>
                                              Duration (seconds)
                                            </Label>
                                            <Input
                                              id={`dur-${item.id}`}
                                              type="number"
                                              min={1}
                                              className="h-9 w-full min-w-0 text-sm tabular-nums"
                                              key={`d-${item.id}-${item.duration_seconds}`}
                                              defaultValue={item.duration_seconds ?? 10}
                                              onBlur={(e) => {
                                                const raw = e.target.value.trim();
                                                const value = Number(raw);
                                            const nextValue =
                                              Number.isFinite(value) && value > 0 ? value : 10;
                                            void updateDuration(item.id, nextValue);
                                              }}
                                            />
                                          </>
                                        )}
                                      </div>
                                      <div className="flex justify-end">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                          onClick={() => void removeItem(item.id)}
                                          aria-label="Remove clip"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {dropProvided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            </div>

            <PlaylistAssetsPanel
              droppableId="media-library"
              libraryResetKey={libraryResetKey}
              librarySearch={librarySearch}
              onLibrarySearchChange={setLibrarySearch}
              filteredLibrary={filteredLibrary}
              onAddMedia={addMediaByClick}
              ownerId={ownerId}
              readOnly={!canManageTvPlaylist}
              storageFull={storageFull}
            />
          </div>
        </DragDropContext>
      )}

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

function ScreenPlaylistRowThumb({ item }: { item: PlaylistItemWithMedia }) {
  const url = mediaPublicUrl(item.media.storage_path);
  return (
    <div className="relative h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {item.media.file_type === "image" ? (
        <Image src={url} alt="" fill className="object-cover" sizes="72px" />
      ) : item.media.file_type === "video" ? (
        <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <FileImage className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
