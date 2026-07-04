"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { Media, PlaylistItemWithMedia, Website } from "@signage/types";
import {
  Clock,
  FileImage,
  FileVideo,
  Globe,
  GripVertical,
  Image as ImageIcon,
  Monitor,
  Pencil,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { contentLibraryPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureMediaVideoDuration } from "@/lib/media";
import { getMediaPublicBaseUrl, mediaPublicUrl } from "@/lib/object-storage/urls";
import { buildPlaylistItemInsertRow, formatPlaylistClockLabel } from "@/lib/playlist-timing";
import { cn } from "@/lib/utils";
import { PlaylistAssetsPanel } from "@/components/playlist-assets-panel";
import { PlaylistItemSavingOverlay } from "@/components/playlist/playlist-item-saving-overlay";
import { WebsitePreviewFrame } from "@/components/websites/website-preview-frame";
import { applyWebsiteSearchFilter } from "@/lib/website-display";
import {
  createPendingMediaItem,
  createPendingWebsiteItem,
} from "@/lib/persist-playlist-draft";
import {
  formatPlaylistItemMeta,
  playlistItemIsWebsite,
  playlistItemKind,
  playlistItemTitle,
} from "@/lib/playlist-item-display";
import { PlaylistPreviewButton } from "@/components/playlist-preview";
import { ReadonlyVideoDuration } from "@/components/readonly-video-duration";
import { useEnsurePlaylistVideoDurations } from "@/hooks/use-ensure-playlist-video-durations";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { isStorageFull } from "@/lib/plan-quota";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { useWorkspaceOptional } from "@/components/workspace/workspace-provider";

const EMPTY_PLAYLIST_ITEMS: PlaylistItemWithMedia[] = [];

type EditorPlaylistItem = PlaylistItemWithMedia & { isPending?: boolean };

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  if (!removed) return list;
  result.splice(endIndex, 0, removed);
  return result;
}

function RowThumb({ item }: { item: PlaylistItemWithMedia }) {
  if (playlistItemIsWebsite(item)) {
    return (
      <div className="relative h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        <WebsitePreviewFrame website={item.website!} className="pointer-events-none h-full w-full" />
        <span className="absolute bottom-0.5 right-0.5 inline-flex h-4 w-4 items-center justify-center rounded bg-black/70 text-white">
          <Globe className="h-2.5 w-2.5" aria-hidden />
        </span>
      </div>
    );
  }

  const url = mediaPublicUrl(item.media!.storage_path);
  return (
    <div className="relative h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {item.media!.file_type === "image" ? (
        <Image src={url} alt="" fill className="object-cover" sizes="72px" />
      ) : item.media!.file_type === "video" ? (
        <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <FileImage className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

interface PlaylistEditorProps {
  playlistId: string;
  initialName: string;
}

export function PlaylistEditor({ playlistId, initialName }: PlaylistEditorProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const adminRoutes = useAdminClientRoutes();
  const libraryHref = contentLibraryPath(adminRoutes);
  const adminStaff = useOptionalAdminStaff();
  const readOnly = adminStaff != null && !adminStaff.canWrite;
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const workspace = useWorkspaceOptional();
  const plan = usePlanQuota();
  const storageFull = plan != null && isStorageFull(plan);
  const { syncNow } = useConsoleSync();
  const cachedItems = useConsoleDataStore(
    (s) => s.playlistItemsByPlaylistId[playlistId] ?? EMPTY_PLAYLIST_ITEMS,
  );
  const allMedia = useConsoleDataStore((s) => s.media) as Media[];
  const allWebsites = useConsoleDataStore((s) => s.websites) as Website[];
  const [name, setName] = useState(initialName);
  const [items, setItems] = useState<EditorPlaylistItem[]>(cachedItems);
  const [savingName, setSavingName] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryResetKey, setLibraryResetKey] = useState(0);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setItems((current) => {
      if (current.some((item) => item.isPending)) return current;
      return cachedItems;
    });
  }, [cachedItems]);

  const reloadFromServer = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  useEnsurePlaylistVideoDurations(items, supabase, reloadFromServer);

  const playlistTimingLabel = useMemo(() => formatPlaylistClockLabel(items), [items]);

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return allMedia;
    return allMedia.filter((m) => (m.original_filename ?? m.storage_path).toLowerCase().includes(q));
  }, [allMedia, librarySearch]);

  const filteredWebsites = useMemo(
    () => applyWebsiteSearchFilter(allWebsites, librarySearch),
    [allWebsites, librarySearch],
  );

  const saveName = useCallback(async () => {
    if (readOnly) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a playlist name.");
      return;
    }
    if (trimmed === initialName.trim()) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase.from("playlists").update({ name: trimmed }).eq("id", playlistId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Playlist name updated");
      await reloadFromServer();
      setIsEditingName(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save name";
      toast.error(message);
    } finally {
      setSavingName(false);
    }
  }, [initialName, name, playlistId, readOnly, reloadFromServer, supabase]);

  const cancelEditingName = useCallback(() => {
    setName(initialName);
    setIsEditingName(false);
  }, [initialName]);

  const persistOrder = useCallback(
    async (next: EditorPlaylistItem[]) => {
      if (readOnly) return;
      const persisted = next.filter((item) => !item.isPending);
      const updates = persisted.map((item, index) =>
        supabase.from("playlist_items").update({ sort_order: index }).eq("id", item.id),
      );
      if (updates.length === 0) return;
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        toast.error(failed.error.message);
        await reloadFromServer();
        return;
      }
      await reloadFromServer();
    },
    [readOnly, reloadFromServer, supabase],
  );

  const addMediaAtIndex = useCallback(
    async (mediaId: string, destIndex: number) => {
      if (readOnly) return;
      const mediaRow =
        allMedia.find((m) => m.id === mediaId) ??
        (useConsoleDataStore.getState().media as Media[]).find((m) => m.id === mediaId);
      if (!mediaRow) return;

      const pendingDraft = createPendingMediaItem(mediaRow, destIndex);
      pendingDraft.playlist_id = playlistId;
      const pending: EditorPlaylistItem = { ...pendingDraft, isPending: true };

      setItems((current) => {
        const next = [...current];
        next.splice(destIndex, 0, pending);
        return next;
      });

      const rollbackPending = (message: string) => {
        setItems((current) => current.filter((item) => item.id !== pending.id));
        toast.error(message);
      };

      if (mediaRow.file_type === "video") {
        await ensureMediaVideoDuration(supabase, mediaRow);
      }

      const sortLen = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId]?.length ?? 0;
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
      if (error || !row) {
        rollbackPending(error?.message ?? "Insert failed");
        return;
      }

      await syncNow();
      const fresh = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? [];
      const serverItem = fresh.find((item) => item.id === row.id);
      if (!serverItem) {
        rollbackPending("Added item could not be loaded");
        return;
      }

      let resolvedNext: EditorPlaylistItem[] = [];
      setItems((current) => {
        let next = current.filter((item) => item.id !== pending.id && item.id !== row.id);
        next.splice(destIndex, 0, serverItem);
        const fromIndex = next.findIndex((item) => item.id === row.id);
        if (fromIndex >= 0 && fromIndex !== destIndex) {
          next = reorder(next, fromIndex, destIndex);
        }
        resolvedNext = next;
        return next;
      });

      const needsPersist = fresh.findIndex((item) => item.id === row.id) !== destIndex;
      if (needsPersist) {
        await persistOrder(resolvedNext);
      }
    },
    [allMedia, persistOrder, playlistId, readOnly, supabase, syncNow],
  );

  const addWebsiteAtIndex = useCallback(
    async (websiteId: string, destIndex: number) => {
      if (readOnly) return;
      const website =
        allWebsites.find((entry) => entry.id === websiteId) ??
        (useConsoleDataStore.getState().websites as Website[]).find((entry) => entry.id === websiteId);
      if (!website) return;

      const pendingDraft = createPendingWebsiteItem(website, destIndex);
      pendingDraft.playlist_id = playlistId;
      const pending: EditorPlaylistItem = { ...pendingDraft, isPending: true };

      setItems((current) => {
        const next = [...current];
        next.splice(destIndex, 0, pending);
        return next;
      });

      const rollbackPending = (message: string) => {
        setItems((current) => current.filter((item) => item.id !== pending.id));
        toast.error(message);
      };

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
      if (error || !row) {
        rollbackPending(error.message ?? "Insert failed");
        return;
      }

      await syncNow();
      const fresh = useConsoleDataStore.getState().playlistItemsByPlaylistId[playlistId] ?? [];
      const serverItem = fresh.find((item) => item.id === row.id);
      if (!serverItem) {
        rollbackPending("Added item could not be loaded");
        return;
      }

      let resolvedNext: EditorPlaylistItem[] = [];
      setItems((current) => {
        let next = current.filter((item) => item.id !== pending.id && item.id !== row.id);
        next.splice(destIndex, 0, serverItem);
        const fromIndex = next.findIndex((item) => item.id === row.id);
        if (fromIndex >= 0 && fromIndex !== destIndex) {
          next = reorder(next, fromIndex, destIndex);
        }
        resolvedNext = next;
        return next;
      });

      const needsPersist = fresh.findIndex((item) => item.id === row.id) !== destIndex;
      if (needsPersist) {
        await persistOrder(resolvedNext);
      }
    },
    [allWebsites, persistOrder, playlistId, readOnly, supabase, syncNow],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (readOnly) return;
      const target = items.find((item) => item.id === id);
      if (target?.isPending) {
        setItems((current) => current.filter((item) => item.id !== id));
        return;
      }
      const { error } = await supabase.from("playlist_items").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Removed from playlist");
      await reloadFromServer();
    },
    [items, readOnly, reloadFromServer, supabase],
  );

  const updateDuration = useCallback(
    async (id: string, duration: number) => {
      if (readOnly) return;
      const target = items.find((item) => item.id === id);
      if (target?.isPending) return;
      const { error } = await supabase.from("playlist_items").update({ duration_seconds: duration }).eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await reloadFromServer();
    },
    [items, readOnly, reloadFromServer, supabase],
  );

  const persistVideoMediaDuration = useCallback(
    async (mediaId: string, seconds: number) => {
      if (readOnly) return;
      const { error } = await supabase.from("media").update({ duration_seconds: seconds }).eq("id", mediaId);
      if (error) return;
      await reloadFromServer();
    },
    [readOnly, reloadFromServer, supabase],
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (readOnly) return;
      const { destination, source, draggableId } = result;
      if (!destination) {
        if (draggableId.startsWith("media-") || draggableId.startsWith("website-")) {
          setLibraryResetKey((k) => k + 1);
        }
        return;
      }

      if (
        (source.droppableId === "playlist-library" || source.droppableId === "playlist-library-websites") &&
        (destination.droppableId === "playlist-library" || destination.droppableId === "playlist-library-websites")
      ) {
        setLibraryResetKey((k) => k + 1);
        return;
      }

      if (draggableId.startsWith("media-") && destination.droppableId === "playlist-main") {
        const mediaId = draggableId.replace(/^media-/, "");
        await addMediaAtIndex(mediaId, destination.index);
        return;
      }

      if (draggableId.startsWith("website-") && destination.droppableId === "playlist-main") {
        const websiteId = draggableId.replace(/^website-/, "");
        await addWebsiteAtIndex(websiteId, destination.index);
        return;
      }

      if (draggableId.startsWith("clip-") && destination.droppableId === "playlist-library") {
        const itemId = draggableId.replace(/^clip-/, "");
        await removeItem(itemId);
        setLibraryResetKey((k) => k + 1);
        return;
      }

      if (draggableId.startsWith("clip-") && destination.droppableId === "playlist-library-websites") {
        const itemId = draggableId.replace(/^clip-/, "");
        await removeItem(itemId);
        setLibraryResetKey((k) => k + 1);
        return;
      }

      if (
        draggableId.startsWith("clip-") &&
        source.droppableId === "playlist-main" &&
        destination.droppableId === "playlist-main"
      ) {
        if (destination.index === source.index) return;
        const next = reorder(items, source.index, destination.index);
        setItems(next);
        await persistOrder(next);
      }
    },
    [addMediaAtIndex, addWebsiteAtIndex, items, persistOrder, readOnly, removeItem],
  );

  if (!getMediaPublicBaseUrl()) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Missing NEXT_PUBLIC_MEDIA_BASE_URL. Copy `apps/web/.env.example` to `.env.local` to preview thumbnails.
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4">
        <div className="space-y-4">
          {!isEditingName ? (
            <div className="flex max-w-full flex-wrap items-center gap-1.5">
              <h1 className="min-w-0 w-fit max-w-full text-balance text-2xl font-semibold tracking-tight text-foreground leading-snug">
                <span className="break-words [overflow-wrap:anywhere]">{initialName}</span>
              </h1>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="inline-flex h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setName(initialName);
                    setIsEditingName(true);
                  }}
                  aria-label="Edit playlist name"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Input
                id="playlist-title"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 min-w-0 flex-1 text-lg font-semibold sm:max-w-xl"
                aria-label="Playlist name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveName();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEditingName();
                  }
                }}
              />
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="secondary" disabled={savingName || !name.trim()} onClick={() => void saveName()}>
                  {savingName ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" disabled={savingName} onClick={cancelEditingName}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <div
            className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label="Playlist summary"
          >
            <span
              role="listitem"
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-muted/35 px-2.5 py-0.5 text-[0.6875rem] leading-tight tabular-nums"
            >
              <span className="shrink-0 text-muted-foreground">Items</span>
              <span className="min-w-0 font-medium text-foreground">
                {items.length} {items.length === 1 ? "clip" : "clips"}
              </span>
            </span>
            <span
              role="listitem"
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-muted/35 px-2.5 py-0.5 text-[0.6875rem] leading-tight tabular-nums"
            >
              <Clock className="h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={2} />
              <span className="shrink-0 text-muted-foreground">Duration</span>
              <span className="min-w-0 font-medium text-foreground">{playlistTimingLabel}</span>
            </span>
          </div>
        </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
            <div className="border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <h2 className="text-sm font-semibold text-foreground">Playlist control</h2>
                  <p className="text-xs text-muted-foreground">
                    Drag rows to reorder. Drop media from the library on the right.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
                  <PlaylistPreviewButton items={items} playlistName={isEditingName ? name : initialName} />
                  <Link
                    href="/screens"
                    className={cn(buttonVariants({ size: "sm" }), "gap-2 font-semibold")}
                  >
                    <Monitor className="h-4 w-4" />
                    Assign to screens
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <Droppable droppableId="playlist-main">
                {(dropProvided) => (
                  <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="overflow-x-auto">
                    <div className="min-w-[520px]">
                      <div
                        className="grid grid-cols-[40px_88px_1fr_72px_88px_44px] gap-2 border-b border-border pb-2 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground"
                        role="row"
                      >
                        <span className="pl-1">#</span>
                        <span>Thumb</span>
                        <span>Title</span>
                        <span>Type</span>
                        <span>Duration</span>
                        <span className="text-right pr-1" />
                      </div>
                      {items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-14 text-center">
                          <p className="text-sm font-medium text-foreground">Nothing in this playlist yet</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add clips from the library on the right, or{" "}
                            <Link href={libraryHref} className="font-medium text-foreground underline-offset-4 hover:underline">
                              upload files in Library
                            </Link>
                            .
                          </p>
                        </div>
                      ) : (
                        items.map((item, index) => (
                          <Draggable
                            key={item.id}
                            draggableId={`clip-${item.id}`}
                            index={index}
                            isDragDisabled={item.isPending}
                          >
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                role="row"
                                className={cn(
                                  "relative border-b border-border/80 py-2.5",
                                  snapshot.isDragging && "rounded-lg bg-brand-softest ring-2 ring-brand-faint25",
                                  item.isPending && "bg-brand-softest/40",
                                )}
                              >
                                <div
                                  className={cn(
                                    "grid items-center gap-2",
                                    "grid-cols-[40px_88px_1fr_72px_88px_44px]",
                                  )}
                                >
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
                                  <RowThumb item={item} />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{playlistItemTitle(item)}</p>
                                    <p className="truncate text-xs text-muted-foreground">{formatPlaylistItemMeta(item)}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    {playlistItemKind(item) === "video" ? (
                                      <FileVideo className="h-4 w-4 shrink-0" />
                                    ) : playlistItemKind(item) === "website" ? (
                                      <Globe className="h-4 w-4 shrink-0" />
                                    ) : (
                                      <ImageIcon className="h-4 w-4 shrink-0" />
                                    )}
                                    <span className="text-xs capitalize">{playlistItemKind(item)}</span>
                                  </div>
                                  <div>
                                    {playlistItemIsWebsite(item) || item.media?.file_type !== "video" ? (
                                      <>
                                        <Label className="sr-only" htmlFor={`duration-${item.id}`}>
                                          Duration (seconds)
                                        </Label>
                                        <Input
                                          id={`duration-${item.id}`}
                                          type="number"
                                          min={1}
                                          className="h-9 w-full min-w-0 text-sm tabular-nums"
                                          key={`d-${item.id}-${item.duration_seconds}`}
                                          defaultValue={item.duration_seconds ?? 10}
                                          readOnly={readOnly || item.isPending}
                                          disabled={readOnly || item.isPending}
                                          onBlur={(e) => {
                                            if (readOnly) return;
                                            const raw = e.target.value.trim();
                                            const value = Number(raw);
                                            const nextValue =
                                              Number.isFinite(value) && value > 0 ? value : 10;
                                            void updateDuration(item.id, nextValue);
                                          }}
                                        />
                                      </>
                                    ) : (
                                      <ReadonlyVideoDuration
                                        id={`duration-video-${item.id}`}
                                        durationSeconds={item.media!.duration_seconds}
                                        fallbackProbeUrl={mediaPublicUrl(item.media!.storage_path)}
                                        onProbedDuration={(sec) =>
                                          void persistVideoMediaDuration(item.media!.id, sec)
                                        }
                                      />
                                    )}
                                  </div>
                                  <div className="flex justify-end">
                                    {!readOnly ? (
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
                                    ) : null}
                                  </div>
                                </div>
                                {item.isPending ? <PlaylistItemSavingOverlay /> : null}
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

      {ownerId ? (
        <PlaylistAssetsPanel
          droppableId="playlist-library"
          libraryResetKey={libraryResetKey}
          librarySearch={librarySearch}
          onLibrarySearchChange={setLibrarySearch}
          filteredLibrary={filteredLibrary}
          filteredWebsites={filteredWebsites}
          onAddMedia={(mediaId) => void addMediaAtIndex(mediaId, items.length)}
          onAddWebsite={(websiteId) => void addWebsiteAtIndex(websiteId, items.length)}
          ownerId={ownerId}
          workspaceId={workspace?.activeWorkspaceId}
          readOnly={readOnly}
          storageFull={storageFull}
        />
      ) : null}
      </div>
    </DragDropContext>
  );
}
