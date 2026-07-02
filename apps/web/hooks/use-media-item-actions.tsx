"use client";

import type { Media } from "@signage/types";
import {
  ArrowRightLeft,
  FolderInput,
  ListChecks,
  ListPlus,
  ListX,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { type ActionMenuItem } from "@/components/console/item-action-menu";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { isStorageFull } from "@/lib/plan-quota";
import { contentFileManagementPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { AddMediaToScreensDialog } from "@/components/media/add-media-to-screens-dialog";
import { MoveMediaToFolderDialog } from "@/components/media/move-media-to-folder-dialog";
import { MediaDeleteDialog } from "@/components/media/media-delete-dialog";
import { useWorkspaceOptional } from "@/components/workspace/workspace-provider";
import { permissionHint, useWorkspacePermission } from "@/components/workspace/permission-guard";
import { MoveToWorkspaceDialog } from "@/components/workspace/move-to-workspace-dialog";
import { MEDIA_UPLOAD_ACCEPT, replaceMediaFile, type MediaUploadProgress } from "@/lib/upload-media";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import {
  addMediaToDevicePlaylists,
  countPlaylistReferences,
  type AddMediaToPlaylistsOptions,
  moveMediaBatchToFolder,
  removeMediaFromAllPlaylists,
} from "@/lib/media-playlist-ops";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { findMediaFolderContainingFile } from "@/lib/media-folder-navigation";

export type MediaItemActionMenuScope = "content-library" | "playlist-picker";

export function useMediaItemActions({
  userId,
  readOnly = false,
  menuScope = "content-library",
}: {
  userId: string;
  readOnly?: boolean;
  /** Playlist sidebar omits bulk playlist / folder actions that belong on the Content page. */
  menuScope?: MediaItemActionMenuScope;
}) {
  const adminRoutes = useAdminClientRoutes();
  const { syncNow } = useConsoleSync();
  const plan = usePlanQuota();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const workspace = useWorkspaceOptional();
  const canManageContent = useWorkspacePermission("manage_content");
  const canChangePlaylists = useWorkspacePermission("change_playlists");
  const contentHint = permissionHint("manage_content");
  const canMoveBetweenWorkspaces = (workspace?.workspaces.length ?? 0) > 1;
  const devices = useConsoleDataStore((s) => s.devices);
  const mediaGroups = useConsoleDataStore((s) => s.mediaGroups);
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);
  const storageFull = plan != null && isStorageFull(plan);
  const fileManagementHref = contentFileManagementPath(adminRoutes);

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState<MediaUploadProgress | null>(null);
  const [addToScreensMedia, setAddToScreensMedia] = useState<Media | Media[] | null>(null);
  const [moveMediaTarget, setMoveMediaTarget] = useState<Media | Media[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Media | Media[] | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [mediaPendingMove, setMediaPendingMove] = useState<Media | null>(null);

  async function removeMedia(row: Media) {
    let response: Response;
    try {
      response = await fetch("/api/media/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, storagePath: row.storage_path, ownerId: userId }),
      });
    } catch {
      toast.error("Network error while deleting media.");
      return;
    }

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
  }

  const handleRemoveFromPlaylists = useCallback(
    async (item: Media) => {
      const { removedCount, error } = await removeMediaFromAllPlaylists(supabase, item.id);
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
    },
    [supabase, syncNow],
  );

  const handleAddToScreens = useCallback(
    async (deviceIds: string[], options: AddMediaToPlaylistsOptions) => {
      const targets = Array.isArray(addToScreensMedia)
        ? addToScreensMedia
        : addToScreensMedia
          ? [addToScreensMedia]
          : [];
      if (targets.length === 0 || deviceIds.length === 0) return;

      const selectedDevices = devices.filter((device) => deviceIds.includes(device.id));
      const { addedCount, error } = await addMediaToDevicePlaylists(
        supabase,
        userId,
        targets,
        selectedDevices,
        playlistItemsByPlaylistId,
        options,
      );
      if (error) {
        toast.error(error);
        return;
      }
      const first = targets[0];
      toast.success(
        targets.length === 1 && first
          ? `Added “${first.original_filename ?? first.storage_path}” to ${addedCount} screen${addedCount === 1 ? "" : "s"}.`
          : `Added ${targets.length} files to ${addedCount} screen${addedCount === 1 ? "" : "s"}.`,
      );
      await syncNow();
    },
    [addToScreensMedia, devices, playlistItemsByPlaylistId, supabase, syncNow, userId],
  );

  const handleMoveToFolder = useCallback(
    async (targetFolderId: string | null) => {
      const targets = Array.isArray(moveMediaTarget)
        ? moveMediaTarget
        : moveMediaTarget
          ? [moveMediaTarget]
          : [];
      if (targets.length === 0) return;

      const { error } = await moveMediaBatchToFolder(
        supabase,
        targets.map((item) => item.id),
        targetFolderId,
      );
      if (error) {
        toast.error(error);
        return;
      }

      const label =
        targets.length > 1
          ? `${targets.length} files moved`
          : `Moved “${targets[0]?.original_filename ?? "file"}”`;
      toast.success(targetFolderId ? `${label} to folder` : `${label} to ungrouped`);
      useConsoleDataStore.setState((state) => ({
        mediaGroups: state.mediaGroups.map((group) => {
          const without = group.member_media_ids.filter((id) => !targets.some((item) => item.id === id));
          if (targetFolderId && group.id === targetFolderId) {
            const merged = new Set([...without, ...targets.map((item) => item.id)]);
            return { ...group, member_media_ids: [...merged] };
          }
          return { ...group, member_media_ids: without };
        }),
      }));
      await syncNow();
    },
    [moveMediaTarget, supabase, syncNow],
  );

  const handleConfirmDelete = useCallback(async () => {
    const targets = Array.isArray(deleteTarget) ? deleteTarget : deleteTarget ? [deleteTarget] : [];
    if (targets.length === 0) return;

    setDeleteInProgress(true);
    try {
      for (const row of targets) {
        await removeMedia(row);
      }
      setDeleteTarget(null);
    } finally {
      setDeleteInProgress(false);
    }
  }, [deleteTarget, syncNow, userId]);

  const handleReplaceFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const mediaId = replaceTargetId;
      setReplaceTargetId(null);
      if (!file || !mediaId) return;

      setReplacing(true);
      setReplaceProgress(null);
      try {
        const { media, error } = await replaceMediaFile(file, mediaId, userId, setReplaceProgress);
        if (error || !media) {
          toast.error(error ?? "Replace failed");
          return;
        }
        toast.success(`Replaced with ${media.original_filename ?? media.storage_path}`);
        await syncNow();
      } finally {
        setReplacing(false);
        setReplaceProgress(null);
      }
    },
    [replaceTargetId, syncNow, userId],
  );

  const buildActionItems = useCallback(
    (item: Media): ActionMenuItem[] => {
      if (readOnly) {
        return [
          {
            label: "Open file",
            onClick: () => window.open(mediaPublicUrl(item.storage_path), "_blank", "noopener,noreferrer"),
          },
        ];
      }

      const contentLibraryItems: ActionMenuItem[] =
        menuScope === "content-library"
          ? [
              {
                label: "Add to the playlists of multiple screens",
                icon: <ListPlus className="h-4 w-4 shrink-0" aria-hidden />,
                onClick: () => setAddToScreensMedia(item),
                disabled: !canChangePlaylists || devices.length === 0,
                disabledReason: canChangePlaylists ? undefined : permissionHint("change_playlists"),
              },
              {
                label: "Remove from all playlists",
                icon: <ListX className="h-4 w-4 shrink-0" aria-hidden />,
                onClick: () => void handleRemoveFromPlaylists(item),
                disabled:
                  !canChangePlaylists || countPlaylistReferences(playlistItemsByPlaylistId, item.id) === 0,
                disabledReason: canChangePlaylists ? undefined : permissionHint("change_playlists"),
              },
              {
                label: "Move to a different folder",
                icon: <FolderInput className="h-4 w-4 shrink-0" aria-hidden />,
                onClick: () => setMoveMediaTarget(item),
                disabled: !canManageContent,
                disabledReason: contentHint,
              },
            ]
          : [];

      return [
        ...contentLibraryItems,
        ...(canMoveBetweenWorkspaces
          ? [
              {
                label: "Move to a different workspace",
                icon: <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />,
                onClick: () => setMediaPendingMove(item),
                disabled: !canManageContent,
                disabledReason: contentHint,
              },
            ]
          : []),
        {
          label: "Replace file",
          icon: <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: () => {
            setReplaceTargetId(item.id);
            replaceInputRef.current?.click();
          },
          disabled: !canManageContent || storageFull,
          disabledReason: canManageContent ? undefined : contentHint,
        },
        {
          label: "Delete file",
          icon: <Trash2 className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: () => setDeleteTarget(item),
          destructive: true,
          disabled: !canManageContent,
          disabledReason: contentHint,
        },
        {
          label: "File management",
          description: "Manage multiple files at once",
          icon: <ListChecks className="h-4 w-4 shrink-0" aria-hidden />,
          separatorBefore: true,
          href: fileManagementHref,
        },
      ];
    },
    [
      canChangePlaylists,
      canManageContent,
      canMoveBetweenWorkspaces,
      contentHint,
      devices.length,
      fileManagementHref,
      handleRemoveFromPlaylists,
      menuScope,
      playlistItemsByPlaylistId,
      readOnly,
      storageFull,
    ],
  );

  const actionDialogs: ReactNode = (
    <>
      <input
        ref={replaceInputRef}
        type="file"
        accept={Object.keys(MEDIA_UPLOAD_ACCEPT).join(",")}
        className="hidden"
        onChange={(event) => void handleReplaceFile(event)}
      />

      {menuScope === "content-library" ? (
        <>
          <AddMediaToScreensDialog
            open={addToScreensMedia != null}
            onClose={() => setAddToScreensMedia(null)}
            mediaItems={
              Array.isArray(addToScreensMedia) ? addToScreensMedia : addToScreensMedia ? [addToScreensMedia] : []
            }
            devices={devices}
            onConfirm={handleAddToScreens}
          />

          <MoveMediaToFolderDialog
            open={moveMediaTarget != null}
            onClose={() => setMoveMediaTarget(null)}
            mediaName={
              Array.isArray(moveMediaTarget)
                ? `${moveMediaTarget.length} files`
                : (moveMediaTarget?.original_filename ?? "file")
            }
            mediaCount={Array.isArray(moveMediaTarget) ? moveMediaTarget.length : 1}
            folders={mediaGroups}
            currentFolderId={
              Array.isArray(moveMediaTarget) || !moveMediaTarget
                ? null
                : (findMediaFolderContainingFile(mediaGroups, moveMediaTarget.id)?.id ?? null)
            }
            onConfirm={handleMoveToFolder}
          />
        </>
      ) : null}

      <MediaDeleteDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title={
          Array.isArray(deleteTarget) && deleteTarget.length > 1
            ? `Delete ${deleteTarget.length} files?`
            : "Delete file?"
        }
        description={
          Array.isArray(deleteTarget) && deleteTarget.length > 1
            ? "These files will be permanently removed from your library. Files used in playlists may fail to delete until removed from those playlists."
            : "This file will be permanently removed from your library. If it is used in a playlist, remove it from playlists first or use “Remove from all playlists”."
        }
        confirmLabel={Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "Delete files" : "Delete file"}
        isConfirming={deleteInProgress}
        onConfirm={handleConfirmDelete}
      />

      <MoveToWorkspaceDialog
        open={mediaPendingMove != null}
        onClose={() => setMediaPendingMove(null)}
        entityType="media"
        entityId={mediaPendingMove?.id ?? ""}
        entityLabel={mediaPendingMove?.original_filename ?? "file"}
      />
    </>
  );

  return {
    buildActionItems,
    actionDialogs,
    replacing,
    replaceProgress,
    openDeleteDialog: (item: Media) => setDeleteTarget(item),
  };
}
