"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { Media, PlaylistItemWithMedia, PlaylistTransitionStyle } from "@signage/types";
import {
  ArrowDown,
  FileImage,
  FileVideo,
  GripVertical,
  Image as ImageIcon,
  ListVideo,
  Plus,
  Settings2,
  Shuffle,
  Trash2,
  Tv,
} from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { groupsListPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import { effectiveDeviceStatus } from "@/lib/device-status";
import { resolveGroupColor } from "@/lib/device-group-colors";
import { ensureMediaVideoDuration } from "@/lib/media";
import { getMediaPublicBaseUrl, mediaPublicUrl } from "@/lib/object-storage/urls";
import { buildPlaylistItemInsertRow, formatPlaylistClockLabel } from "@/lib/playlist-timing";
import { cn } from "@/lib/utils";
import { PlaylistAssetsPanel } from "@/components/playlist-assets-panel";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { PlaylistPreviewButton } from "@/components/playlist-preview";
import { ReadonlyVideoDuration } from "@/components/readonly-video-duration";
import { useEnsurePlaylistVideoDurations } from "@/hooks/use-ensure-playlist-video-durations";
import { ItemActionMenu } from "@/components/console/item-action-menu";
import { PlaylistTransitionsDialog } from "@/components/devices/playlist-transitions-dialog";
import { clearDevicePlaylist } from "@/lib/copy-device-playlist";
import { isStorageFull } from "@/lib/plan-quota";
import { ensurePlaylistForGroup, syncGroupPlaylistToMembers } from "@/lib/group-playlist";
import { DeviceGroupEditorDialog } from "@/components/device-groups/device-group-editor-dialog";

const EMPTY_PLAYLIST_ITEMS: PlaylistItemWithMedia[] = [];

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  if (!removed) return list;
  result.splice(endIndex, 0, removed);
  return result;
}

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
  const allMedia = useConsoleDataStore((s) => s.media) as Media[];
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

  const cachedItems = useConsoleDataStore((s) =>
    playlistId
      ? (s.playlistItemsByPlaylistId[playlistId] ?? EMPTY_PLAYLIST_ITEMS)
      : EMPTY_PLAYLIST_ITEMS,
  );
  const [items, setItems] = useState<PlaylistItemWithMedia[]>(cachedItems);
  const [libraryResetKey, setLibraryResetKey] = useState(0);
  const [librarySearch, setLibrarySearch] = useState("");
  const [transitionsDialogOpen, setTransitionsDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setItems(cachedItems);
  }, [cachedItems]);

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
    // Sync once when opening a group; membership changes are handled in the editor dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groupId + groupReady scope the initial sync
  }, [groupId, groupReady, canManagePlaylist, ownerId]);

  useEnsurePlaylistVideoDurations(items, supabase, reloadFromServer);

  const resolvePlaylistId = useCallback(async (): Promise<string | null> => {
    if (!group) return null;
    if (playlistId) return playlistId;
    const { playlistId: ensured, error } = await ensurePlaylistForGroup(supabase, ownerId, group);
    if (error || !ensured) {
      toast.error(error ?? "Unable to prepare group playlist");
      return null;
    }
    useConsoleDataStore.setState((state) => ({
      deviceGroups: state.deviceGroups.map((entry) =>
        entry.id === group.id ? { ...entry, playlist_id: ensured } : entry,
      ),
    }));
    await reloadFromServer();
    return ensured;
  }, [group, ownerId, playlistId, reloadFromServer, supabase]);

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
      toast.success("Removed from group playlist");
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

      if (draggableId.startsWith("media-") && destination.droppableId === "group-playlist") {
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
        source.droppableId === "group-playlist" &&
        destination.droppableId === "group-playlist"
      ) {
        if (destination.index === source.index) return;
        const next = reorder(items, source.index, destination.index);
        setItems(next);
        await persistOrder(next);
      }
    },
    [addMediaAtIndex, items, persistOrder, playlistId, removeItem, resolvePlaylistId],
  );

  const handleClearPlaylist = useCallback(async () => {
    if (!playlistId) return;
    const { error } = await clearDevicePlaylist(supabase, playlistId);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Group playlist cleared");
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

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return allMedia;
    return allMedia.filter((m) => (m.original_filename ?? m.storage_path).toLowerCase().includes(q));
  }, [allMedia, librarySearch]);

  const playlistTimingLabel = useMemo(() => formatPlaylistClockLabel(items), [items]);

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

  const playlistMenuItems = [
    {
      label: "Playlist transitions",
      onClick: () => setTransitionsDialogOpen(true),
      icon: <Shuffle className="h-3.5 w-3.5" aria-hidden />,
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

      {!canManagePlaylist ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
          <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-5">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Group playlist</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {items.length > 0
                  ? `${items.length} ${items.length === 1 ? "item" : "items"} (${playlistTimingLabel}).`
                  : "No content in this group playlist yet."}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ListVideo className="h-4 w-4 text-muted-foreground" aria-hidden />
                        <h2 className="text-base font-semibold text-foreground">Group playlist</h2>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {items.length} {items.length === 1 ? "item" : "items"} · {playlistTimingLabel}
                        {memberDevices.length > 0
                          ? ` · plays on ${memberDevices.length} screen${memberDevices.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PlaylistPreviewButton
                        items={items}
                        playlistName={group.name}
                        frame={{ kind: "playlist" }}
                      />
                      <ItemActionMenu ariaLabel="Group playlist actions" items={playlistMenuItems} />
                    </div>
                  </div>
                </div>

                <div className="p-3 sm:p-4">
                  <Droppable droppableId="group-playlist">
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
                                Build your playlist by dragging content from the right to here
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
                                      <GroupPlaylistRowThumb item={item} />
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
              readOnly={!canManagePlaylist}
              storageFull={storageFull}
            />
          </div>
        </DragDropContext>
      )}

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

function GroupPlaylistRowThumb({ item }: { item: PlaylistItemWithMedia }) {
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
