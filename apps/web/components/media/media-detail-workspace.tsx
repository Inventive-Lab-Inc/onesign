"use client";

import type { Media } from "@signage/types";
import {
  FolderInput,
  ListChecks,
  ListPlus,
  ListX,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import {
  contentFileManagementPath,
  contentLibraryPath,
  useAdminClientRoutes,
} from "@/components/admin/admin-client-route-context";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { ItemActionMenu, type ActionMenuItem } from "@/components/console/item-action-menu";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { AddMediaToScreensDialog } from "@/components/media/add-media-to-screens-dialog";
import { MediaDeleteDialog } from "@/components/media/media-delete-dialog";
import { MoveMediaToFolderDialog } from "@/components/media/move-media-to-folder-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppRouter } from "@/hooks/use-app-router";
import {
  buildMediaInformationRows,
  fromDatetimeLocalValue,
  mediaDisplayTitle,
  normalizeMediaTags,
  toDatetimeLocalValue,
} from "@/lib/media-information";
import { findMediaFolderContainingFile } from "@/lib/media-folder-navigation";
import {
  addMediaToDevicePlaylists,
  countPlaylistReferences,
  type AddMediaToPlaylistsOptions,
  removeMediaFromAllPlaylists,
  moveMediaBatchToFolder,
} from "@/lib/media-playlist-ops";
import { isStorageFull } from "@/lib/plan-quota";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { MEDIA_UPLOAD_ACCEPT, replaceMediaFile } from "@/lib/upload-media";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useConsoleDataStore } from "@/stores/console-data-store";

function InfoRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-3 py-2.5 text-sm">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MediaDetailWorkspace({
  mediaId,
  ownerId,
  readOnly = false,
}: {
  mediaId: string;
  ownerId: string;
  readOnly?: boolean;
}) {
  const adminRoutes = useAdminClientRoutes();
  const adminStaff = useOptionalAdminStaff();
  const router = useAppRouter();
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();
  const plan = usePlanQuota();
  const storageFull = plan != null && isStorageFull(plan);

  const media = useConsoleDataStore((s) => s.media.find((item) => item.id === mediaId));
  const devices = useConsoleDataStore((s) => s.devices);
  const mediaGroups = useConsoleDataStore((s) => s.mediaGroups);
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);
  const patchMedia = useConsoleDataStore((s) => s.patchMedia);

  const [dimensions, setDimensions] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [displayFrom, setDisplayFrom] = useState("");
  const [displayUntil, setDisplayUntil] = useState("");
  const [initializedForId, setInitializedForId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!media || initializedForId === media.id) return;
    setInitializedForId(media.id);
    setTitle(mediaDisplayTitle(media));
    setDescription(media.description ?? "");
    setTags(normalizeMediaTags(media.tags ?? []));
    setDisplayFrom(toDatetimeLocalValue(media.display_from));
    setDisplayUntil(toDatetimeLocalValue(media.display_until));
    setDimensions(null);
  }, [media, initializedForId]);

  const [addToScreensOpen, setAddToScreensOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdRef = useRef<string | null>(null);

  const effectiveReadOnly = readOnly || adminStaff?.canWrite === false;
  const folder = media ? findMediaFolderContainingFile(mediaGroups, media.id) : null;
  const backHref = contentLibraryPath(adminRoutes, folder?.id ?? null);
  const fileManagementHref = contentFileManagementPath(adminRoutes);

  const infoRows = useMemo(
    () => (media ? buildMediaInformationRows(media, dimensions) : []),
    [media, dimensions],
  );

  const hasChanges = useMemo(() => {
    if (!media) return false;
    return (
      title.trim() !== mediaDisplayTitle(media) ||
      description.trim() !== (media.description ?? "").trim() ||
      JSON.stringify(tags) !== JSON.stringify(normalizeMediaTags(media.tags ?? [])) ||
      displayFrom !== toDatetimeLocalValue(media.display_from) ||
      displayUntil !== toDatetimeLocalValue(media.display_until)
    );
  }, [media, title, description, tags, displayFrom, displayUntil]);

  const addTag = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setTags((current) => {
        const next = normalizeMediaTags([...current, trimmed]);
        return next.length === current.length ? current : next;
      });
      setTagDraft("");
    },
    [],
  );

  const removeTag = useCallback((tag: string) => {
    setTags((current) => current.filter((entry) => entry !== tag));
  }, []);

  const saveChanges = useCallback(async () => {
    if (!media || effectiveReadOnly || !hasChanges) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/media/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: media.id,
          ownerId,
          original_filename: trimmedTitle,
          description: description.trim() || null,
          tags,
          display_from: fromDatetimeLocalValue(displayFrom),
          display_until: fromDatetimeLocalValue(displayUntil),
        }),
      });

      let payload: { error?: string; media?: Media };
      try {
        payload = (await response.json()) as { error?: string; media?: Media };
      } catch {
        toast.error("Invalid server response while saving.");
        return;
      }

      if (!response.ok) {
        toast.error(payload.error ?? "Unable to save changes.");
        return;
      }

      if (payload.media) {
        patchMedia(media.id, payload.media);
      }
      toast.success("Changes saved.");
      await syncNow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }, [
    media,
    effectiveReadOnly,
    hasChanges,
    title,
    description,
    tags,
    displayFrom,
    displayUntil,
    ownerId,
    patchMedia,
    syncNow,
  ]);

  const handleRemoveFromPlaylists = useCallback(async () => {
    if (!media) return;
    const { removedCount, error } = await removeMediaFromAllPlaylists(supabase, media.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      removedCount === 0
        ? "This file is not in any playlists."
        : `Removed from ${removedCount} playlist ${removedCount === 1 ? "entry" : "entries"}.`,
    );
    await syncNow();
  }, [media, supabase, syncNow]);

  const handleAddToScreens = useCallback(
    async (deviceIds: string[], options: AddMediaToPlaylistsOptions) => {
      if (!media || deviceIds.length === 0) return;
      const selectedDevices = devices.filter((device) => deviceIds.includes(device.id));
      const { addedCount, error } = await addMediaToDevicePlaylists(
        supabase,
        ownerId,
        [media],
        selectedDevices,
        playlistItemsByPlaylistId,
        options,
      );
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(
        `Added “${mediaDisplayTitle(media)}” to ${addedCount} screen${addedCount === 1 ? "" : "s"}.`,
      );
      await syncNow();
    },
    [media, devices, supabase, ownerId, playlistItemsByPlaylistId, syncNow],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!media) return;
    setDeleteInProgress(true);
    try {
      const response = await fetch("/api/media/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: media.id, storagePath: media.storage_path, ownerId }),
      });
      let payload: { error?: string };
      try {
        payload = (await response.json()) as { error?: string };
      } catch {
        toast.error("Invalid server response while deleting media.");
        return;
      }
      if (!response.ok) {
        toast.error(payload.error ?? "Delete failed");
        return;
      }
      toast.success("Media deleted");
      await syncNow();
      router.push(backHref);
    } finally {
      setDeleteInProgress(false);
      setDeleteOpen(false);
    }
  }, [media, ownerId, syncNow, router, backHref]);

  async function handleReplaceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const targetId = replaceTargetIdRef.current;
    if (!file || !targetId) return;

    const result = await replaceMediaFile(file, targetId, ownerId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("File replaced");
    await syncNow();
    setDimensions(null);
  }

  const actionItems = useMemo((): ActionMenuItem[] => {
    if (!media) return [];
    if (effectiveReadOnly) {
      return [
        {
          label: "Open file",
          onClick: () => window.open(mediaPublicUrl(media.storage_path), "_blank", "noopener,noreferrer"),
        },
      ];
    }

    return [
      {
        label: "Add to the playlists of multiple screens",
        icon: <ListPlus className="h-4 w-4 shrink-0" aria-hidden />,
        onClick: () => setAddToScreensOpen(true),
        disabled: devices.length === 0,
      },
      {
        label: "Remove from all playlists",
        icon: <ListX className="h-4 w-4 shrink-0" aria-hidden />,
        onClick: () => void handleRemoveFromPlaylists(),
        disabled: countPlaylistReferences(playlistItemsByPlaylistId, media.id) === 0,
      },
      {
        label: "Move to a different folder",
        icon: <FolderInput className="h-4 w-4 shrink-0" aria-hidden />,
        onClick: () => setMoveOpen(true),
      },
      {
        label: "Replace file",
        icon: <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />,
        onClick: () => {
          replaceTargetIdRef.current = media.id;
          replaceInputRef.current?.click();
        },
        disabled: storageFull,
      },
      {
        label: "Delete file",
        icon: <Trash2 className="h-4 w-4 shrink-0" aria-hidden />,
        onClick: () => setDeleteOpen(true),
        destructive: true,
      },
      {
        label: "File management",
        description: "Manage multiple files at once",
        icon: <ListChecks className="h-4 w-4 shrink-0" aria-hidden />,
        separatorBefore: true,
        href: fileManagementHref,
      },
    ];
  }, [
    media,
    effectiveReadOnly,
    devices.length,
    playlistItemsByPlaylistId,
    handleRemoveFromPlaylists,
    storageFull,
    fileManagementHref,
  ]);

  if (!media) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  const previewUrl = mediaPublicUrl(media.storage_path);
  const heading = mediaDisplayTitle(media);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <BackNavLink href={backHref} label="Back to content library" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{heading}</h1>
            <ItemActionMenu ariaLabel={`Actions for ${heading}`} items={actionItems} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
            <div className="relative aspect-video w-full bg-muted/40">
              {media.file_type === "image" ? (
                <Image
                  src={previewUrl}
                  alt=""
                  fill
                  className="object-contain p-2"
                  sizes="(max-width: 1024px) 100vw, 720px"
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setDimensions(`${img.naturalWidth}×${img.naturalHeight}`);
                    }
                  }}
                />
              ) : media.file_type === "video" ? (
                <video
                  className="h-full w-full object-contain"
                  src={previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                      setDimensions(`${video.videoWidth}×${video.videoHeight}`);
                    }
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No preview available
                </div>
              )}
            </div>
          </div>

          <InfoRows rows={infoRows} />
        </div>

        <aside className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Media details</h2>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="media-detail-title">Title *</Label>
                  <Input
                    id="media-detail-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={effectiveReadOnly || saving}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="media-detail-description">Description</Label>
                  <textarea
                    id="media-detail-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={effectiveReadOnly || saving}
                    rows={4}
                    placeholder="Optional description"
                    className={cn(
                      "flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                      "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground">Tags</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter optional tags to help organize your content.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground"
                  >
                    {tag}
                    {!effectiveReadOnly ? (
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Remove tag ${tag}`}
                        disabled={saving}
                        onClick={() => removeTag(tag)}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    ) : null}
                  </span>
                ))}
                {!effectiveReadOnly ? (
                  <Input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag(tagDraft);
                      }
                    }}
                    onBlur={() => {
                      if (tagDraft.trim()) addTag(tagDraft);
                    }}
                    placeholder="Type and press Enter"
                    disabled={saving}
                    className="h-8 min-w-[8rem] flex-1 text-xs"
                    aria-label="Add content tag"
                  />
                ) : null}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Media will not show on any screens before the start date or after the expiry date. Leave blank to
                always show.
              </p>
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="media-detail-start">Start date &amp; time</Label>
                  <Input
                    id="media-detail-start"
                    type="datetime-local"
                    value={displayFrom}
                    onChange={(event) => setDisplayFrom(event.target.value)}
                    disabled={effectiveReadOnly || saving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="media-detail-expiry">Expiry date &amp; time</Label>
                  <Input
                    id="media-detail-expiry"
                    type="datetime-local"
                    value={displayUntil}
                    onChange={(event) => setDisplayUntil(event.target.value)}
                    disabled={effectiveReadOnly || saving}
                  />
                </div>
              </div>
            </div>

            {!effectiveReadOnly ? (
              <Button
                type="button"
                className="w-full"
                disabled={!hasChanges || saving}
                onClick={() => void saveChanges()}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            ) : null}
          </div>
        </aside>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept={Object.keys(MEDIA_UPLOAD_ACCEPT).join(",")}
        className="hidden"
        onChange={(event) => void handleReplaceFile(event)}
      />

      <AddMediaToScreensDialog
        open={addToScreensOpen}
        onClose={() => setAddToScreensOpen(false)}
        mediaItems={[media]}
        devices={devices}
        onConfirm={handleAddToScreens}
      />

      <MoveMediaToFolderDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        mediaName={heading}
        mediaCount={1}
        folders={mediaGroups}
        currentFolderId={folder?.id ?? null}
        onConfirm={async (targetFolderId) => {
          if (!media) return;
          const { error } = await moveMediaBatchToFolder(supabase, [media.id], targetFolderId);
          if (error) {
            toast.error(error);
            return;
          }
          toast.success(targetFolderId ? "Moved to folder." : "Removed from folder.");
          await syncNow();
        }}
      />

      <MediaDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete file?"
        description="This file will be permanently removed from your library. If it is used in a playlist, remove it from playlists first or use “Remove from all playlists”."
        confirmLabel="Delete file"
        isConfirming={deleteInProgress}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
