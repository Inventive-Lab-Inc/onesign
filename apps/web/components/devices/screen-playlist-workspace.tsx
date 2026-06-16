"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import type { Media, PlaylistItemWithMedia, Website } from "@signage/types";
import { ArrowDown, Copy, Shuffle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ItemActionMenu } from "@/components/console/item-action-menu";
import { PlaylistPreviewButton, type PlaylistPreviewFrameContext } from "@/components/playlist-preview";
import { PlaylistAssetsPanel } from "@/components/playlist-assets-panel";
import { PlaylistItemDailyTimesDialog } from "@/components/devices/playlist-item-daily-times-dialog";
import { PlaylistItemPeriodicDialog } from "@/components/devices/playlist-item-periodic-dialog";
import { ScreenPlaylistItemCard } from "@/components/devices/screen-playlist-item-card";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { applyWebsiteSearchFilter } from "@/lib/website-display";
import {
  draftItemSnapshot,
  persistPlaylistDraft,
  toDraftItems,
  type DraftPlaylistItem,
} from "@/lib/persist-playlist-draft";
import { buildPlaylistItemInsertRow, formatAbleSignPlaylistSummary } from "@/lib/playlist-timing";
import { ensureMediaVideoDuration } from "@/lib/media";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { clearDevicePlaylist } from "@/lib/copy-device-playlist";

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  if (!removed) return list;
  result.splice(endIndex, 0, removed);
  return result;
}

export function ScreenPlaylistWorkspace({
  playlistName,
  screenTimezone,
  ownerId,
  playlistId,
  canManage = true,
  storageFull = false,
  previewFrame,
  onCopyToScreens,
  onOpenTransitions,
  otherDeviceCount = 0,
}: {
  playlistName: string;
  screenTimezone?: string | null;
  ownerId: string;
  playlistId: string;
  canManage?: boolean;
  storageFull?: boolean;
  previewFrame: PlaylistPreviewFrameContext;
  onCopyToScreens?: () => void;
  onOpenTransitions?: () => void;
  otherDeviceCount?: number;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { syncNow } = useConsoleSync();
  const allMedia = useConsoleDataStore((s) => s.media) as Media[];
  const allWebsites = useConsoleDataStore((s) => s.websites) as Website[];

  const cachedItems = useConsoleDataStore((s) =>
    playlistId ? (s.playlistItemsByPlaylistId[playlistId] ?? []) : [],
  );

  const [baselineItems, setBaselineItems] = useState<PlaylistItemWithMedia[]>(cachedItems);
  const [draftItems, setDraftItems] = useState<DraftPlaylistItem[]>(toDraftItems(cachedItems));
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryResetKey, setLibraryResetKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dailyTimesItem, setDailyTimesItem] = useState<DraftPlaylistItem | null>(null);
  const [periodicItem, setPeriodicItem] = useState<DraftPlaylistItem | null>(null);

  const isDirty = useMemo(
    () => draftItemSnapshot(draftItems) !== draftItemSnapshot(toDraftItems(baselineItems)),
    [draftItems, baselineItems],
  );

  useEffect(() => {
    if (isDirty) return;
    setBaselineItems(cachedItems);
    setDraftItems(toDraftItems(cachedItems));
  }, [cachedItems, isDirty]);

  useEffect(() => {
    const fresh = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? [];
    setBaselineItems(fresh);
    setDraftItems(toDraftItems(fresh));
  }, [playlistId]);

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return allMedia;
    return allMedia.filter((m) => (m.original_filename ?? m.storage_path).toLowerCase().includes(q));
  }, [allMedia, librarySearch]);

  const filteredWebsites = useMemo(
    () => applyWebsiteSearchFilter(allWebsites, librarySearch),
    [allWebsites, librarySearch],
  );

  const summaryLabel = useMemo(() => formatAbleSignPlaylistSummary(draftItems), [draftItems]);

  const reloadFromServer = useCallback(async () => {
    await syncNow();
    const fresh = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? [];
    setBaselineItems(fresh);
    setDraftItems(toDraftItems(fresh));
  }, [playlistId, syncNow]);

  const updateDraftItem = useCallback((draftKey: string, patch: Partial<DraftPlaylistItem>) => {
    setDraftItems((current) =>
      current.map((item) => (item.draftKey === draftKey ? { ...item, ...patch } : item)),
    );
  }, []);

  const persistOrder = useCallback(
    async (next: DraftPlaylistItem[]) => {
      const updates = next
        .filter((item) => !item.isPending)
        .map((item, index) =>
          supabase.from("playlist_items").update({ sort_order: index }).eq("id", item.id),
        );
      if (updates.length === 0) return;
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        toast.error(failed.error.message);
        await reloadFromServer();
        return;
      }
      await reloadFromServer();
    },
    [reloadFromServer, supabase],
  );

  const removeDraftItem = useCallback(
    async (draftKey: string) => {
      const item = draftItems.find((entry) => entry.draftKey === draftKey);
      if (!item) return;
      setDraftItems((current) => current.filter((entry) => entry.draftKey !== draftKey));
      if (item.isPending) return;

      const { error } = await supabase.from("playlist_items").delete().eq("id", item.id);
      if (error) {
        toast.error(error.message);
        await reloadFromServer();
        return;
      }
      setBaselineItems((current) => current.filter((entry) => entry.id !== item.id));
      toast.success("Removed from playlist");
      await syncNow();
    },
    [draftItems, reloadFromServer, supabase, syncNow],
  );

  const duplicateDraftItem = useCallback(
    async (draftKey: string) => {
      const source = draftItems.find((entry) => entry.draftKey === draftKey);
      if (!source || source.isPending) return;
      const index = draftItems.findIndex((entry) => entry.draftKey === draftKey);
      const sortOrder = index + 1;

      if (source.website_id) {
        const { error } = await supabase.from("playlist_items").insert({
          playlist_id: playlistId,
          website_id: source.website_id,
          sort_order: sortOrder,
          duration_seconds: source.duration_seconds ?? 30,
          display_from: source.display_from,
          display_until: source.display_until,
          daily_schedule_enabled: source.daily_schedule_enabled ?? false,
          daily_schedule: source.daily_schedule_enabled ? source.daily_schedule : null,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
      } else if (source.media_id) {
        const mediaRow = allMedia.find((m) => m.id === source.media_id);
        if (mediaRow?.file_type === "video") {
          await ensureMediaVideoDuration(supabase, mediaRow);
        }
        const { error } = await supabase.from("playlist_items").insert(
          buildPlaylistItemInsertRow({
            playlistId,
            mediaId: source.media_id,
            sortOrder,
            fileType: mediaRow?.file_type,
            durationSeconds: source.duration_seconds ?? undefined,
          }),
        );
        if (error) {
          toast.error(error.message);
          return;
        }
      } else {
        return;
      }

      await reloadFromServer();
      const fresh = toDraftItems(
        useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? [],
      );
      await persistOrder(fresh);
    },
    [allMedia, draftItems, persistOrder, playlistId, reloadFromServer, supabase],
  );

  const moveDraftItem = useCallback(
    async (draftKey: string, direction: -1 | 1) => {
      const index = draftItems.findIndex((entry) => entry.draftKey === draftKey);
      if (index < 0) return;
      const target = index + direction;
      if (target < 0 || target >= draftItems.length) return;
      const next = reorder(draftItems, index, target);
      setDraftItems(next);
      await persistOrder(next);
    },
    [draftItems, persistOrder],
  );

  const addMediaAtIndex = useCallback(
    async (mediaId: string, destIndex: number) => {
      const sortLen = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId]?.length ?? 0;
      const mediaRow =
        allMedia.find((m) => m.id === mediaId) ??
        (useConsoleDataStore.getState().media as Media[]).find((m) => m.id === mediaId);
      if (!mediaRow) return;
      if (mediaRow.file_type === "video") {
        await ensureMediaVideoDuration(supabase, mediaRow);
      }
      const { data: row, error } = await supabase
        .from("playlist_items")
        .insert(
          buildPlaylistItemInsertRow({
            playlistId,
            mediaId,
            sortOrder: sortLen,
            fileType: mediaRow.file_type,
          }),
        )
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadFromServer();
      const fresh = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? [];
      const fromIndex = fresh.findIndex((item) => item.id === row.id);
      if (fromIndex < 0) return;
      if (fromIndex !== destIndex) {
        const reordered = reorder(toDraftItems(fresh), fromIndex, destIndex);
        setDraftItems(reordered);
        await persistOrder(reordered);
      }
    },
    [allMedia, playlistId, reloadFromServer, supabase],
  );

  const addWebsiteAtIndex = useCallback(
    async (websiteId: string, destIndex: number) => {
      const sortLen = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId]?.length ?? 0;
      const { data: row, error } = await supabase
        .from("playlist_items")
        .insert({
          playlist_id: playlistId,
          website_id: websiteId,
          sort_order: sortLen,
          duration_seconds: 30,
        })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadFromServer();
      const fresh = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? [];
      const fromIndex = fresh.findIndex((item) => item.id === row.id);
      if (fromIndex < 0) return;
      if (fromIndex !== destIndex) {
        const reordered = reorder(toDraftItems(fresh), fromIndex, destIndex);
        setDraftItems(reordered);
        await persistOrder(reordered);
      }
    },
    [playlistId, reloadFromServer, supabase],
  );

  const handleDurationChange = useCallback(
    async (draftKey: string, seconds: number) => {
      const item = draftItems.find((entry) => entry.draftKey === draftKey);
      updateDraftItem(draftKey, { duration_seconds: seconds });
      if (!item || item.isPending) return;
      const { error } = await supabase
        .from("playlist_items")
        .update({ duration_seconds: seconds })
        .eq("id", item.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await syncNow();
    },
    [draftItems, supabase, syncNow, updateDraftItem],
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) {
        if (draggableId.startsWith("media-") || draggableId.startsWith("website-")) {
          setLibraryResetKey((k) => k + 1);
        }
        return;
      }

      if (
        (source.droppableId === "media-library" || source.droppableId === "media-library-websites") &&
        (destination.droppableId === "media-library" || destination.droppableId === "media-library-websites")
      ) {
        setLibraryResetKey((k) => k + 1);
        return;
      }

      if (draggableId.startsWith("media-") && destination.droppableId === "screen-playlist") {
        await addMediaAtIndex(draggableId.replace(/^media-/, ""), destination.index);
        return;
      }

      if (draggableId.startsWith("website-") && destination.droppableId === "screen-playlist") {
        await addWebsiteAtIndex(draggableId.replace(/^website-/, ""), destination.index);
        return;
      }

      if (
        draggableId.startsWith("pi-") &&
        source.droppableId === "screen-playlist" &&
        destination.droppableId === "screen-playlist"
      ) {
        const draftKey = draggableId.replace(/^pi-/, "");
        const fromIndex = draftItems.findIndex((item) => item.draftKey === draftKey);
        if (fromIndex < 0 || destination.index === fromIndex) return;
        const next = reorder(draftItems, fromIndex, destination.index);
        setDraftItems(next);
        await persistOrder(next);
      }
    },
    [addMediaAtIndex, addWebsiteAtIndex, draftItems, persistOrder],
  );

  const saveChanges = useCallback(async () => {
    if (!playlistId || !isDirty) return;
    setSaving(true);
    try {
      const { error } = await persistPlaylistDraft(
        supabase,
        playlistId,
        draftItems,
        baselineItems,
        allMedia,
      );
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Playlist saved");
      await syncNow();
      const fresh =
        useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? cachedItems;
      setBaselineItems(fresh);
      setDraftItems(toDraftItems(fresh));
    } finally {
      setSaving(false);
    }
  }, [allMedia, baselineItems, draftItems, isDirty, playlistId, supabase, syncNow]);

  const handleClearPlaylist = useCallback(async () => {
    if (!playlistId) return;
    const { error } = await clearDevicePlaylist(supabase, playlistId);
    if (error) {
      toast.error(error);
      return;
    }
    setDraftItems([]);
    setBaselineItems([]);
    toast.success("Playlist cleared");
    await syncNow();
  }, [playlistId, supabase, syncNow]);

  const playlistMenuItems = [
    {
      label: "Playlist transitions",
      onClick: () => onOpenTransitions?.(),
      icon: <Shuffle className="h-3.5 w-3.5" aria-hidden />,
    },
    {
      label: "Copy playlist to other screens",
      onClick: () => onCopyToScreens?.(),
      icon: <Copy className="h-3.5 w-3.5" aria-hidden />,
      disabled: otherDeviceCount === 0 || !onCopyToScreens,
    },
    {
      label: "Clear playlist",
      onClick: () => void handleClearPlaylist(),
      destructive: true,
      icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
    },
  ];

  function buildItemMenu(item: DraftPlaylistItem, index: number) {
    return [
      {
        label: "Set daily display times",
        onClick: () => setDailyTimesItem(item),
      },
      {
        label: "Schedule periodic display",
        onClick: () => setPeriodicItem(item),
      },
      { label: "Move item up", onClick: () => void moveDraftItem(item.draftKey, -1), disabled: index === 0 },
      {
        label: "Move item down",
        onClick: () => void moveDraftItem(item.draftKey, 1),
        disabled: index === draftItems.length - 1,
      },
      { label: "Duplicate item", onClick: () => void duplicateDraftItem(item.draftKey) },
      {
        label: "Remove from playlist",
        onClick: () => void removeDraftItem(item.draftKey),
        destructive: true,
        separatorBefore: true,
      },
    ];
  }

  if (!canManage) {
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
        <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold text-foreground">Playlist</h2>
          <p className="mt-1 text-sm text-muted-foreground">{summaryLabel}</p>
        </div>
        {draftItems.length > 0 ? (
          <div className="px-4 py-4 sm:px-5">
            <PlaylistPreviewButton items={draftItems} playlistName={playlistName} frame={previewFrame} />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={(result) => void onDragEnd(result)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
              <div className="border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">Playlist</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{summaryLabel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PlaylistPreviewButton
                      items={draftItems}
                      playlistName={playlistName}
                      frame={previewFrame}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!isDirty || saving}
                      onClick={() => void saveChanges()}
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </Button>
                    <ItemActionMenu ariaLabel="Playlist actions" items={playlistMenuItems} />
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4">
                <Droppable droppableId="screen-playlist">
                  {(dropProvided) => (
                    <div
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className="space-y-3"
                    >
                      {draftItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-4 py-16 text-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <ArrowDown className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            Add content by dragging content from the right to here
                          </p>
                        </div>
                      ) : (
                        draftItems.map((item, index) => (
                          <ScreenPlaylistItemCard
                            key={item.draftKey}
                            item={item}
                            index={index}
                            menuItems={buildItemMenu(item, index)}
                            onDurationChange={(draftKey, seconds) =>
                              void handleDurationChange(draftKey, seconds)
                            }
                            onVideoDurationProbed={async (mediaId, seconds) => {
                              await supabase.from("media").update({ duration_seconds: seconds }).eq("id", mediaId);
                              await syncNow();
                            }}
                          />
                        ))
                      )}
                      {dropProvided.placeholder}
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
            filteredWebsites={filteredWebsites}
            onAddMedia={(mediaId) => void addMediaAtIndex(mediaId, draftItems.length)}
            onAddWebsite={(websiteId) => void addWebsiteAtIndex(websiteId, draftItems.length)}
            ownerId={ownerId}
            storageFull={storageFull}
          />
        </div>
      </DragDropContext>

      <PlaylistItemDailyTimesDialog
        open={dailyTimesItem != null}
        onClose={() => setDailyTimesItem(null)}
        item={dailyTimesItem}
        screenTimezone={screenTimezone}
        onSaved={(patch) => {
          if (!dailyTimesItem) return;
          updateDraftItem(dailyTimesItem.draftKey, patch);
        }}
      />

      <PlaylistItemPeriodicDialog
        open={periodicItem != null}
        onClose={() => setPeriodicItem(null)}
        item={periodicItem}
        onSaved={(patch) => {
          if (!periodicItem) return;
          updateDraftItem(periodicItem.draftKey, patch);
        }}
      />
    </>
  );
}
