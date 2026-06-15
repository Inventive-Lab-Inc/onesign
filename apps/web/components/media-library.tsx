"use client";

import type { Media } from "@signage/types";
import {
  ArrowLeft,
  FileImage,
  FileVideo,
  FolderInput,
  FolderPlus,
  Image as ImageIcon,
  ListChecks,
  ListPlus,
  ListX,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { HeaderPrimaryButton } from "@/components/console/header-primary-button";
import { ListPageHeader } from "@/components/console/list-page-header";
import { Button } from "@/components/ui/button";
import { ItemActionMenu, type ActionMenuItem } from "@/components/console/item-action-menu";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { isStorageFull } from "@/lib/plan-quota";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { contentFileManagementPath, contentLibraryPath, mediaDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { DeviceGroupFolderCard } from "@/components/device-groups/device-group-folder-card";
import { MediaGroupEditorDialog } from "@/components/media-groups/media-group-editor-dialog";
import { AddMediaToScreensDialog } from "@/components/media/add-media-to-screens-dialog";
import { MoveMediaToFolderDialog } from "@/components/media/move-media-to-folder-dialog";
import { MediaDeleteDialog } from "@/components/media/media-delete-dialog";
import { MediaFiltersPopover, type MediaFiltersState } from "@/components/media/media-filters-popover";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { useAppRouter } from "@/hooks/use-app-router";
import { MEDIA_UPLOAD_ACCEPT, replaceMediaFile } from "@/lib/upload-media";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { groupFilterLabel, parseGroupFilterFromSearchParam } from "@/lib/device-group-navigation";
import {
  addMediaToDevicePlaylists,
  countPlaylistReferences,
  type AddMediaToPlaylistsOptions,
  moveMediaBatchToFolder,
  removeMediaFromAllPlaylists,
} from "@/lib/media-playlist-ops";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useConsoleDataStore } from "@/stores/console-data-store";
import {
  applyMediaFilters,
  applyMediaSearchFilter,
  formatMediaAge,
  formatMediaMeta,
  formatVideoDuration,
  sortMediaList,
  type MediaSort,
} from "@/lib/media-display";
import type { MediaGroupWithMembers } from "@/lib/console-sync";
import {
  buildMediaFolderEntries,
  findMediaFolderContainingFile,
  searchMediaFolderEntries,
} from "@/lib/media-folder-navigation";
import "@/components/device-groups/device-groups.css";

interface MediaLibraryProps {
  userId: string;
  /** When true, omits standalone page chrome (used inside Content workspace). */
  embedded?: boolean;
}

const SORT_OPTIONS: { id: MediaSort; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
];

function formatUpdatedAt(iso: string): string {
  return `Updated ${formatMediaAge(iso)}`;
}

const CONTENT_FOLDER_GRID = "device-group-folder-grid device-group-folder-grid--dense";

export function MediaLibrary({ userId, embedded = false }: MediaLibraryProps) {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const adminRoutes = useAdminClientRoutes();
  const { syncNow } = useConsoleSync();
  const plan = usePlanQuota();
  const adminStaff = useOptionalAdminStaff();
  const readOnly = adminStaff != null && !adminStaff.canWrite;
  const items = useConsoleDataStore((s) => s.media) as Media[];
  const mediaGroups = useConsoleDataStore((s) => s.mediaGroups) as MediaGroupWithMembers[];
  const devices = useConsoleDataStore((s) => s.devices);
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);
  const storageFull = plan != null && isStorageFull(plan);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { uploading, uploadFiles } = useMediaUpload(userId, { withDropzone: false });
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mediaSort, setMediaSort] = useState<MediaSort>("newest");
  const [filters, setFilters] = useState<MediaFiltersState>({
    typeFilter: "all",
    orientationFilter: "all",
    dateFilter: "all",
  });
  const view = "grid" as const;
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "edit">("create");
  const [groupBeingEdited, setGroupBeingEdited] = useState<MediaGroupWithMembers | null>(null);
  const [createParentGroupId, setCreateParentGroupId] = useState<string | null>(null);
  const [addToScreensMedia, setAddToScreensMedia] = useState<Media | Media[] | null>(null);
  const [moveMediaTarget, setMoveMediaTarget] = useState<Media | Media[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Media | Media[] | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const groupFilter = useMemo(
    () => parseGroupFilterFromSearchParam(searchParams.get("group"), mediaGroups),
    [searchParams, mediaGroups],
  );

  const activeGroup = useMemo(
    () =>
      groupFilter !== "all" && groupFilter !== "ungrouped"
        ? (mediaGroups.find((g) => g.id === groupFilter) ?? null)
        : null,
    [mediaGroups, groupFilter],
  );

  const navigateToGroup = useCallback(
    (filter: typeof groupFilter) => {
      const href = contentLibraryPath(adminRoutes, filter === "all" ? null : filter);
      router.push(href);
    },
    [adminRoutes, router],
  );

  const groupedMediaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of mediaGroups) {
      for (const mediaId of group.member_media_ids) {
        ids.add(mediaId);
      }
    }
    return ids;
  }, [mediaGroups]);

  const isLibraryRoot = groupFilter === "all" || groupFilter === "ungrouped";
  const isInsideFolder = !isLibraryRoot;
  const showFolderGrid = isLibraryRoot && !search.trim();
  const showSearchResultsGrid = isLibraryRoot && search.trim().length > 0;
  const showFolderContents = isInsideFolder && !search.trim();

  const rootFolderEntries = useMemo(() => buildMediaFolderEntries(mediaGroups, null), [mediaGroups]);

  const childFolderEntries = useMemo(
    () => (activeGroup ? buildMediaFolderEntries(mediaGroups, activeGroup.id) : []),
    [mediaGroups, activeGroup],
  );

  const searchFolderEntries = useMemo(
    () => searchMediaFolderEntries(mediaGroups, search),
    [mediaGroups, search],
  );

  const visibleRootFolderEntries = rootFolderEntries;

  const { typeFilter, orientationFilter, dateFilter } = filters;

  const allLibraryMedia = useMemo(() => {
    return sortMediaList(applyMediaFilters(items, typeFilter, orientationFilter, dateFilter), mediaSort);
  }, [items, typeFilter, orientationFilter, dateFilter, mediaSort, filters]);

  const groupFiltered = useMemo(() => {
    if (groupFilter === "ungrouped") {
      return items.filter((m) => !groupedMediaIds.has(m.id));
    }
    if (groupFilter !== "all") {
      const memberIds = new Set(activeGroup?.member_media_ids ?? []);
      return items.filter((m) => memberIds.has(m.id));
    }
    return items;
  }, [items, groupFilter, groupedMediaIds, activeGroup]);

  const filtered = useMemo(() => {
    return sortMediaList(
      applyMediaSearchFilter(applyMediaFilters(groupFiltered, typeFilter, orientationFilter, dateFilter), search),
      mediaSort,
    );
  }, [groupFiltered, typeFilter, orientationFilter, dateFilter, search, mediaSort]);

  const searchResultMedia = useMemo(() => {
    if (!showSearchResultsGrid) return [];
    return sortMediaList(
      applyMediaFilters(applyMediaSearchFilter(items, search), typeFilter, orientationFilter, dateFilter),
      mediaSort,
    );
  }, [showSearchResultsGrid, items, search, typeFilter, orientationFilter, dateFilter, mediaSort]);

  const activeGroupName = groupFilterLabel(groupFilter, activeGroup);
  const showBackButton = isInsideFolder;

  const pageTitle = useMemo(() => {
    if (isInsideFolder) return activeGroupName;
    if (showSearchResultsGrid) return "Search";
    return "Content library";
  }, [activeGroupName, isInsideFolder, showSearchResultsGrid]);

  const mainPanelSubtitle = useMemo(() => {
    if (showSearchResultsGrid) {
      return `${searchResultMedia.length} match${searchResultMedia.length === 1 ? "" : "es"}`;
    }
    return undefined;
  }, [searchResultMedia.length, showSearchResultsGrid]);

  const fileManagementHref = contentFileManagementPath(adminRoutes);

  const openCreateGroup = useCallback(() => {
    setGroupEditorMode("create");
    setGroupBeingEdited(null);
    setCreateParentGroupId(isInsideFolder && activeGroup ? activeGroup.id : null);
    setGroupEditorOpen(true);
  }, [activeGroup, isInsideFolder]);

  const openEditGroup = useCallback((group: MediaGroupWithMembers) => {
    setGroupEditorMode("edit");
    setGroupBeingEdited(group);
    setGroupEditorOpen(true);
  }, []);

  const handleBack = useCallback(() => {
    if (activeGroup?.parent_id) {
      navigateToGroup(activeGroup.parent_id);
      return;
    }
    navigateToGroup("all");
  }, [activeGroup, navigateToGroup]);

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop: (files) => void uploadFiles(files),
    accept: MEDIA_UPLOAD_ACCEPT,
    multiple: true,
    disabled: uploading || readOnly || storageFull,
    noClick: true,
    noKeyboard: true,
  });

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

  const buildMediaActionItems = useCallback(
    (item: Media): ActionMenuItem[] => {
      if (readOnly) {
        return [{ label: "Open file", onClick: () => window.open(mediaPublicUrl(item.storage_path), "_blank", "noopener,noreferrer") }];
      }

      return [
        {
          label: "Add to the playlists of multiple screens",
          icon: <ListPlus className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: () => setAddToScreensMedia(item),
          disabled: devices.length === 0,
        },
        {
          label: "Remove from all playlists",
          icon: <ListX className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: () => void handleRemoveFromPlaylists(item),
          disabled: countPlaylistReferences(playlistItemsByPlaylistId, item.id) === 0,
        },
        {
          label: "Move to a different folder",
          icon: <FolderInput className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: () => setMoveMediaTarget(item),
        },
        {
          label: "Replace file",
          icon: <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: () => {
            setReplaceTargetId(item.id);
            replaceInputRef.current?.click();
          },
          disabled: storageFull,
        },
        {
          label: "Delete file",
          icon: <Trash2 className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: () => setDeleteTarget(item),
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
    },
    [devices.length, fileManagementHref, playlistItemsByPlaylistId, readOnly, storageFull],
  );

  async function handleRemoveFromPlaylists(item: Media) {
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
  }

  async function handleAddToScreens(deviceIds: string[], options: AddMediaToPlaylistsOptions) {
    const targets = Array.isArray(addToScreensMedia) ? addToScreensMedia : addToScreensMedia ? [addToScreensMedia] : [];
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
  }

  async function handleMoveToFolder(targetFolderId: string | null) {
    const targets = Array.isArray(moveMediaTarget) ? moveMediaTarget : moveMediaTarget ? [moveMediaTarget] : [];
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
  }

  async function handleConfirmDelete() {
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
  }

  async function handleReplaceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const mediaId = replaceTargetId;
    setReplaceTargetId(null);
    if (!file || !mediaId) return;

    const { media, error } = await replaceMediaFile(file, mediaId, userId);
    if (error || !media) {
      toast.error(error ?? "Replace failed");
      return;
    }
    toast.success(`Replaced with ${media.original_filename ?? media.storage_path}`);
    await syncNow();
  }

  const titleMenuItems = useMemo<ActionMenuItem[]>(() => {
    if (readOnly) return [];
    return [{ label: "New folder", icon: <FolderPlus className="h-4 w-4 shrink-0" aria-hidden />, onClick: openCreateGroup }];
  }, [openCreateGroup, readOnly]);

  const gridCommonProps = {
    view,
    readOnly,
    buildActionItems: buildMediaActionItems,
    onRemove: readOnly ? undefined : (item: Media) => setDeleteTarget(item),
    returnGroupId:
      groupFilter !== "all" && groupFilter !== "ungrouped" ? groupFilter : null,
  };

  return (
    <div className={cn("flex flex-col", embedded ? "min-h-0" : "min-h-[min(70vh,720px)]")}>
      <div {...getRootProps()} className="flex min-h-full flex-1 flex-col">
        <input {...getInputProps()} />
        <div
          className={cn(
            "flex min-h-full flex-1 flex-col rounded-xl border bg-card shadow-sm transition-colors",
            isDragActive ? "border-primary ring-2 ring-brand-faint20" : "border-border",
          )}
        >
          <ListPageHeader
            title={pageTitle}
            subtitle={mainPanelSubtitle}
            titleMenu={
              titleMenuItems.length > 0 ? (
                <ItemActionMenu ariaLabel="Content library actions" items={titleMenuItems} />
              ) : undefined
            }
            backButton={
              showBackButton ? (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Back to folders"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2.25} />
                </button>
              ) : undefined
            }
            primaryAction={
              !readOnly && !storageFull ? (
                <HeaderPrimaryButton type="button" onClick={() => open()} disabled={uploading}>
                  <Upload className="h-4 w-4" aria-hidden />
                  {uploading ? "Uploading…" : "Upload files"}
                </HeaderPrimaryButton>
              ) : undefined
            }
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search"
            sortOptions={SORT_OPTIONS}
            activeSortId={mediaSort}
            onSortChange={(id) => setMediaSort(id as MediaSort)}
            filtersContent={<MediaFiltersPopover value={filters} onApply={setFilters} />}
          />

          {!readOnly && storageFull ? (
            <div className="border-b border-border px-4 py-2.5 text-xs leading-relaxed text-red-900 dark:text-red-100 sm:px-5">
              Storage is full. Delete files from your library or ask your administrator to increase your plan.
            </div>
          ) : null}

          <div className="flex-1 p-4 sm:p-5">
            {showFolderGrid ? (
              visibleRootFolderEntries.length > 0 ? (
                <div className="space-y-8">
                  <ul className={CONTENT_FOLDER_GRID}>
                    {visibleRootFolderEntries.map(({ group, fileCount }) => (
                      <DeviceGroupFolderCard
                        key={group.id}
                        name={group.name}
                        accentColor={group.accent_color}
                        itemCount={fileCount}
                        itemLabel="file"
                        previewIcon={ImageIcon}
                        compact
                        onOpen={() => navigateToGroup(group.id)}
                        onEdit={readOnly ? undefined : () => openEditGroup(group)}
                      />
                    ))}
                  </ul>
                  {items.length > 0 ? (
                    <div className="space-y-4 border-t border-border pt-8">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        All media
                      </p>
                      <MediaFileGrid items={allLibraryMedia} {...gridCommonProps} />
                    </div>
                  ) : null}
                </div>
              ) : items.length > 0 ? (
                <MediaFileGrid items={allLibraryMedia} {...gridCommonProps} />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No files yet</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Upload images or videos, then organize them into folders.
                  </p>
                  {!readOnly && !storageFull ? (
                    <Button type="button" className="mt-4 gap-2" onClick={() => open()} disabled={uploading}>
                      <Upload className="h-4 w-4" />
                      Upload files
                    </Button>
                  ) : null}
                </div>
              )
            ) : showSearchResultsGrid ? (
              searchResultMedia.length === 0 && searchFolderEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No files match</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">Try another search term or filter.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {searchFolderEntries.length > 0 ? (
                    <div>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        Folders
                      </p>
                      <ul className={CONTENT_FOLDER_GRID}>
                        {searchFolderEntries.map(({ group, fileCount }) => (
                          <DeviceGroupFolderCard
                            key={group.id}
                            name={group.name}
                            accentColor={group.accent_color}
                            itemCount={fileCount}
                            itemLabel="file"
                            previewIcon={ImageIcon}
                            compact
                            onOpen={() => {
                              setSearch("");
                              navigateToGroup(group.id);
                            }}
                            onEdit={readOnly ? undefined : () => openEditGroup(group)}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {searchResultMedia.length > 0 ? (
                    <div className={searchFolderEntries.length > 0 ? "space-y-4 border-t border-border pt-6" : ""}>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        All media
                      </p>
                      <MediaFileGrid items={searchResultMedia} {...gridCommonProps} />
                    </div>
                  ) : null}
                </div>
              )
            ) : showFolderContents ? (
              childFolderEntries.length === 0 && filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">This folder is empty</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Create a subfolder from the title menu, assign files from the folder editor, or upload new assets.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {childFolderEntries.length > 0 ? (
                    <div>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        Folders
                      </p>
                      <ul className={CONTENT_FOLDER_GRID}>
                        {childFolderEntries.map(({ group, fileCount }) => (
                          <DeviceGroupFolderCard
                            key={group.id}
                            name={group.name}
                            accentColor={group.accent_color}
                            itemCount={fileCount}
                            itemLabel="file"
                            previewIcon={ImageIcon}
                            compact
                            onOpen={() => navigateToGroup(group.id)}
                            onEdit={readOnly ? undefined : () => openEditGroup(group)}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {filtered.length > 0 ? (
                    <div className={childFolderEntries.length > 0 ? "space-y-4 border-t border-border pt-8" : ""}>
                      {childFolderEntries.length > 0 ? (
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          Files
                        </p>
                      ) : null}
                      <MediaFileGrid items={filtered} {...gridCommonProps} />
                    </div>
                  ) : null}
                </div>
              )
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                <p className="text-sm font-medium text-foreground">No files match</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {items.length === 0
                    ? "Upload images or videos to see them here. Data is cached locally—use Sync if needed."
                    : "Try another search or filter, or upload new assets."}
                </p>
                {items.length === 0 && !readOnly && !storageFull ? (
                  <Button type="button" className="mt-4 gap-2" onClick={() => open()} disabled={uploading}>
                    <Upload className="h-4 w-4" />
                    Upload files
                  </Button>
                ) : null}
              </div>
            ) : (
              <MediaFileGrid items={filtered} {...gridCommonProps} />
            )}
          </div>
        </div>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept={Object.keys(MEDIA_UPLOAD_ACCEPT).join(",")}
        className="hidden"
        onChange={(event) => void handleReplaceFile(event)}
      />

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

      <MediaGroupEditorDialog
        open={groupEditorOpen}
        mode={groupEditorMode}
        ownerId={userId}
        group={groupBeingEdited}
        media={items}
        parentGroupId={groupEditorMode === "create" ? createParentGroupId : null}
        onClose={() => {
          setGroupEditorOpen(false);
          setCreateParentGroupId(null);
        }}
      />
    </div>
  );
}

function MediaFileGrid({
  items,
  view,
  buildActionItems,
  onRemove,
  returnGroupId = null,
}: {
  items: Media[];
  view: "grid" | "list";
  readOnly: boolean;
  buildActionItems: (item: Media) => ActionMenuItem[];
  onRemove?: (item: Media) => void;
  returnGroupId?: string | null;
}) {
  const adminRoutes = useAdminClientRoutes();

  if (view === "grid") {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            actionItems={buildActionItems(item)}
            detailHref={mediaDetailPath(item.id, adminRoutes, returnGroupId)}
          />
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((item) => (
        <MediaListRow
          key={item.id}
          item={item}
          actionItems={buildActionItems(item)}
          detailHref={mediaDetailPath(item.id, adminRoutes, returnGroupId)}
        />
      ))}
    </ul>
  );
}

function MediaCard({
  item,
  actionItems,
  detailHref,
}: {
  item: Media;
  actionItems: ActionMenuItem[];
  detailHref: string;
}) {
  const url = mediaPublicUrl(item.storage_path);
  const name = item.original_filename ?? item.storage_path;
  const durationLabel = item.file_type === "video" ? formatVideoDuration(item.duration_seconds) : null;

  return (
    <li className="group flex flex-col rounded-lg border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={detailHref}
        className="block overflow-hidden rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Open content: ${name}`}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/70">
          {item.file_type === "image" ? (
            <Image
              src={url}
              alt=""
              fill
              className="object-contain p-0.5 transition-transform group-hover:scale-[1.01]"
              sizes="(max-width: 640px) 50vw, 180px"
            />
          ) : item.file_type === "video" ? (
            <video className="h-full w-full object-contain" src={url} muted playsInline preload="metadata" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview</div>
          )}
          {durationLabel ? (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums text-white">
              {durationLabel}
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex items-start gap-1 border-t border-border/60 bg-card p-2">
        <Link href={detailHref} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground" title={name}>
            {name}
          </p>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">{formatMediaMeta(item)}</p>
        </Link>
        <ItemActionMenu ariaLabel={`Actions for ${name}`} items={actionItems} className="shrink-0" />
      </div>
    </li>
  );
}

function MediaListRow({
  item,
  actionItems,
  detailHref,
}: {
  item: Media;
  actionItems: ActionMenuItem[];
  detailHref: string;
}) {
  const url = mediaPublicUrl(item.storage_path);
  const name = item.original_filename ?? item.storage_path;

  return (
    <li className="flex items-center gap-4 px-3 py-3 transition-colors hover:bg-muted/40">
      <Link
        href={detailHref}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open content: ${name}`}
      >
        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {item.file_type === "image" ? (
            <Image src={url} alt="" fill className="object-cover" sizes="80px" />
          ) : item.file_type === "video" ? (
            <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <FileImage className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{formatUpdatedAt(item.created_at)}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Open
        </a>
        <ItemActionMenu ariaLabel={`Actions for ${name}`} items={actionItems} />
      </div>
    </li>
  );
}
