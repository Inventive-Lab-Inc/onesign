"use client";

import type { Media } from "@signage/types";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  ListPlus,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { contentLibraryPath, mediaDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { DeviceGroupFolderCard } from "@/components/device-groups/device-group-folder-card";
import { ItemActionMenu, type ActionMenuItem } from "@/components/console/item-action-menu";
import { ListPageHeader } from "@/components/console/list-page-header";
import { CONSOLE_PANEL_CHROME } from "@/components/console/console-panel";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { AddMediaToScreensDialog } from "@/components/media/add-media-to-screens-dialog";
import { MediaDeleteDialog } from "@/components/media/media-delete-dialog";
import { MoveMediaToFolderDialog } from "@/components/media/move-media-to-folder-dialog";
import { FileManagementColumnsMenu, type FileManagementColumn } from "@/components/media/file-management-columns-menu";
import { MediaFiltersPopover, type MediaFiltersState } from "@/components/media/media-filters-popover";
import { MediaGroupEditorDialog } from "@/components/media-groups/media-group-editor-dialog";
import { Button } from "@/components/ui/button";
import {
  GatedButton,
  permissionHint,
  useWorkspacePermission,
} from "@/components/workspace/permission-guard";
import {
  addMediaToDevicePlaylists,
  type AddMediaToPlaylistsOptions,
  moveMediaBatchToFolder,
} from "@/lib/media-playlist-ops";
import {
  applyMediaFilters,
  applyMediaSearchFilter,
  formatMediaAge,
  formatMediaFileSize,
  formatStorageTotal,
  sortMediaForFileManagement,
  type FileManagementSort,
} from "@/lib/media-display";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { MediaGroupWithMembers } from "@/lib/console-sync";
import { buildMediaFolderEntries } from "@/lib/media-folder-navigation";
import { useConsoleDataStore } from "@/stores/console-data-store";
import "@/components/device-groups/device-groups.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const FOLDER_GRID = "device-group-folder-grid device-group-folder-grid--dense";

const DEFAULT_VISIBLE_COLUMNS = new Set<FileManagementColumn>(["title", "type", "uploaded", "size"]);

function mediaTypeLabel(fileType: Media["file_type"]): string {
  if (fileType === "image") return "Image";
  if (fileType === "video") return "Video";
  return "File";
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
      {active ? (
        direction === "desc" ? (
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
      )}
    </button>
  );
}

export function FileManagementWorkspace({ userId }: { userId: string }) {
  const adminRoutes = useAdminClientRoutes();
  const plan = usePlanQuota();
  const adminStaff = useOptionalAdminStaff();
  const readOnly = adminStaff != null && !adminStaff.canWrite;
  const canManageContent = useWorkspacePermission("manage_content");
  const canChangePlaylists = useWorkspacePermission("change_playlists");
  const contentHint = permissionHint("manage_content");
  const { syncNow } = useConsoleSync();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const items = useConsoleDataStore((s) => s.media) as Media[];
  const mediaGroups = useConsoleDataStore((s) => s.mediaGroups);
  const devices = useConsoleDataStore((s) => s.devices);
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<MediaFiltersState>({
    typeFilter: "all",
    orientationFilter: "all",
    dateFilter: "all",
  });
  const [tableSort, setTableSort] = useState<FileManagementSort>("uploaded-desc");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<Set<FileManagementColumn>>(() => new Set(DEFAULT_VISIBLE_COLUMNS));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "edit">("create");
  const [groupBeingEdited, setGroupBeingEdited] = useState<MediaGroupWithMembers | null>(null);
  const [createParentGroupId, setCreateParentGroupId] = useState<string | null>(null);
  const [addToScreensMedia, setAddToScreensMedia] = useState<Media[] | null>(null);
  const [moveMediaTarget, setMoveMediaTarget] = useState<Media[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Media[] | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const libraryHref = contentLibraryPath(adminRoutes);

  const { typeFilter, orientationFilter, dateFilter } = filters;

  const activeFolder = useMemo(
    () => (activeFolderId ? (mediaGroups.find((group) => group.id === activeFolderId) ?? null) : null),
    [activeFolderId, mediaGroups],
  );

  const rootFolderEntries = useMemo(
    () => buildMediaFolderEntries(mediaGroups, null, search),
    [mediaGroups, search],
  );

  const childFolderEntries = useMemo(
    () => buildMediaFolderEntries(mediaGroups, activeFolderId, search),
    [mediaGroups, activeFolderId, search],
  );

  const visibleFolderEntries = activeFolderId ? childFolderEntries : rootFolderEntries;

  const scopedItems = useMemo(() => {
    if (!activeFolderId) return items;
    const memberIds = new Set(activeFolder?.member_media_ids ?? []);
    return items.filter((item) => memberIds.has(item.id));
  }, [items, activeFolderId, activeFolder]);

  const filteredItems = useMemo(() => {
    return sortMediaForFileManagement(
      applyMediaSearchFilter(applyMediaFilters(scopedItems, typeFilter, orientationFilter, dateFilter), search),
      tableSort,
    );
  }, [scopedItems, search, tableSort, filters, typeFilter, orientationFilter, dateFilter]);

  const showFolderGrid = visibleFolderEntries.length > 0;

  const stats = useMemo(() => {
    const videoCount = items.filter((item) => item.file_type === "video").length;
    const imageCount = items.filter((item) => item.file_type === "image").length;
    const lastUpload = items.reduce<string | null>((latest, item) => {
      if (!latest) return item.created_at;
      return new Date(item.created_at).getTime() > new Date(latest).getTime() ? item.created_at : latest;
    }, null);
    return {
      storageUsed: plan?.storageUsedBytes ?? items.reduce((sum, item) => sum + (item.size_bytes ?? 0), 0),
      videoCount,
      imageCount,
      lastUpload,
    };
  }, [items, plan?.storageUsedBytes]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = safePageIndex * pageSize;
  const pageItems = filteredItems.slice(pageStart, pageStart + pageSize);
  const pageEnd = Math.min(pageStart + pageItems.length, filteredItems.length);

  const allPageSelected = pageItems.length > 0 && pageItems.every((item) => selectedIds.has(item.id));
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const toggleSort = useCallback((column: "title" | "type" | "uploaded" | "size") => {
    setTableSort((current) => {
      const asc = `${column}-asc` as FileManagementSort;
      const desc = `${column}-desc` as FileManagementSort;
      if (current === desc) return asc;
      return desc;
    });
    setPageIndex(0);
  }, []);

  const toggleSelected = useCallback((mediaId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  }, []);

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const item of pageItems) next.delete(item.id);
      } else {
        for (const item of pageItems) next.add(item.id);
      }
      return next;
    });
  }, [allPageSelected, pageItems]);

  async function removeMedia(row: Media) {
    const response = await fetch("/api/media/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, storagePath: row.storage_path, ownerId: userId }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Delete failed");
    }
  }

  async function handleConfirmDelete() {
    const targets = deleteTarget ?? [];
    if (targets.length === 0) return;
    setDeleteInProgress(true);
    try {
      for (const row of targets) {
        await removeMedia(row);
      }
      toast.success(targets.length === 1 ? "File deleted" : `${targets.length} files deleted`);
      setDeleteTarget(null);
      setSelectedIds(new Set());
      await syncNow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteInProgress(false);
    }
  }

  async function handleAddToScreens(deviceIds: string[], options: AddMediaToPlaylistsOptions) {
    const targets = addToScreensMedia ?? [];
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
    toast.success(
      targets.length === 1
        ? `Added to ${addedCount} screen${addedCount === 1 ? "" : "s"}.`
        : `Added ${targets.length} files to ${addedCount} screen${addedCount === 1 ? "" : "s"}.`,
    );
    await syncNow();
  }

  async function handleMoveToFolder(targetFolderId: string | null) {
    const targets = moveMediaTarget ?? [];
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
    toast.success(targets.length === 1 ? "File moved" : `${targets.length} files moved`);
    await syncNow();
  }

  const titleMenuItems = useMemo<ActionMenuItem[]>(() => {
    if (readOnly) return [];
    return [
      {
        label: "New folder",
        icon: <FolderPlus className="h-4 w-4 shrink-0" aria-hidden />,
        onClick: () => {
          setGroupEditorMode("create");
          setGroupBeingEdited(null);
          setCreateParentGroupId(activeFolderId);
          setGroupEditorOpen(true);
        },
        disabled: !canManageContent,
        disabledReason: contentHint,
      },
    ];
  }, [activeFolderId, readOnly, canManageContent, contentHint]);

  const openEditGroup = useCallback((group: MediaGroupWithMembers) => {
    setGroupEditorMode("edit");
    setGroupBeingEdited(group);
    setGroupEditorOpen(true);
  }, []);

  const pageTitle = activeFolder?.name ?? "File management";

  const sortDirection = (column: "title" | "type" | "uploaded" | "size") =>
    tableSort.startsWith(column) ? (tableSort.endsWith("-desc") ? "desc" : "asc") : "desc";

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col">
      <div className={cn("flex min-h-full flex-1 flex-col", CONSOLE_PANEL_CHROME)}>
        <ListPageHeader
          title={pageTitle}
          backButton={
            activeFolder ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 px-0"
                aria-label={activeFolder?.parent_id ? "Back to parent folder" : "Back to all files"}
                onClick={() => {
                  setActiveFolderId(activeFolder?.parent_id ?? null);
                  setPageIndex(0);
                  setSelectedIds(new Set());
                }}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Button>
            ) : undefined
          }
          titleMenu={
            titleMenuItems.length > 0 ? (
              <ItemActionMenu ariaLabel="File management actions" items={titleMenuItems} />
            ) : undefined
          }
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPageIndex(0);
          }}
          searchPlaceholder="Search"
          toolbarEnd={
            <FileManagementColumnsMenu visibleColumns={visibleColumns} onChange={setVisibleColumns} />
          }
          filtersContent={
            <MediaFiltersPopover
              value={filters}
              onApply={(next) => {
                setFilters(next);
                setPageIndex(0);
              }}
            />
          }
        />

        <div className="grid gap-3 border-b border-border px-4 py-4 sm:grid-cols-3 sm:px-5">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <HardDrive className="h-4 w-4" aria-hidden />
              Storage used
            </div>
            <p className="mt-1 text-lg font-semibold text-foreground">{formatStorageTotal(stats.storageUsed)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ImageIcon className="h-4 w-4" aria-hidden />
              Media
            </div>
            <p className="mt-1 text-sm text-foreground">
              Videos: <span className="font-semibold">{stats.videoCount}</span> · Images:{" "}
              <span className="font-semibold">{stats.imageCount}</span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Upload className="h-4 w-4" aria-hidden />
              Last upload
            </div>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {stats.lastUpload ? formatMediaAge(stats.lastUpload) : "—"}
            </p>
          </div>
        </div>

        {showFolderGrid ? (
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Folders
            </p>
            <ul className={FOLDER_GRID}>
              {visibleFolderEntries.map(({ group, fileCount }) => (
                <DeviceGroupFolderCard
                  key={group.id}
                  name={group.name}
                  accentColor={group.accent_color}
                  itemCount={fileCount}
                  itemLabel="file"
                  previewIcon={ImageIcon}
                  compact
                  onOpen={() => {
                    setActiveFolderId(group.id);
                    setPageIndex(0);
                    setSelectedIds(new Set());
                  }}
                  onEdit={readOnly || !canManageContent ? undefined : () => openEditGroup(group)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {selectedIds.size > 0 && !readOnly ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-brand-softest/40 px-4 py-3 sm:px-5">
            <p className="text-sm font-medium text-foreground">
              {selectedIds.size} Media file{selectedIds.size === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <GatedButton
                permission="change_playlists"
                type="button"
                size="sm"
                className="h-9 gap-1.5"
                disabled={devices.length === 0}
                onClick={() => setAddToScreensMedia(selectedItems)}
              >
                <ListPlus className="h-4 w-4" aria-hidden />
                Add
              </GatedButton>
              <GatedButton
                permission="manage_content"
                type="button"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setMoveMediaTarget(selectedItems)}
              >
                <FolderInput className="h-4 w-4" aria-hidden />
                Move
              </GatedButton>
              <GatedButton
                permission="manage_content"
                type="button"
                variant="destructive"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setDeleteTarget(selectedItems)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </GatedButton>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-x-auto p-4 sm:p-5">
          {filteredItems.length === 0 ? (
            !showFolderGrid ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                <p className="text-sm font-medium text-foreground">
                  {activeFolder ? "This folder is empty" : "No files yet"}
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {activeFolder ? (
                    <>
                      Create a subfolder from the title menu, or move files here with{" "}
                      <span className="font-medium text-foreground">Move</span>.
                    </>
                  ) : showFolderGrid ? (
                    "Try adjusting search or filters, or open a folder above."
                  ) : (
                    <>
                      Upload files from the{" "}
                      <Link href={libraryHref} className="font-medium text-primary hover:underline">
                        content library
                      </Link>
                      , or create a folder from the title menu.
                    </>
                  )}
                </p>
              </div>
            ) : null
          ) : (
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="w-10 pb-3 pr-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={allPageSelected}
                      onChange={toggleSelectAllOnPage}
                      aria-label="Select all on page"
                    />
                  </th>
                  {visibleColumns.has("title") ? (
                    <th className="pb-3 pr-4">
                      <SortHeader
                        label="Title"
                        active={tableSort.startsWith("title")}
                        direction={sortDirection("title") as "asc" | "desc"}
                        onClick={() => toggleSort("title")}
                      />
                    </th>
                  ) : null}
                  {visibleColumns.has("type") ? (
                    <th className="pb-3 pr-4">
                      <SortHeader
                        label="Type"
                        active={tableSort.startsWith("type")}
                        direction={sortDirection("type") as "asc" | "desc"}
                        onClick={() => toggleSort("type")}
                      />
                    </th>
                  ) : null}
                  {visibleColumns.has("uploaded") ? (
                    <th className="pb-3 pr-4">
                      <SortHeader
                        label="Uploaded"
                        active={tableSort.startsWith("uploaded")}
                        direction={sortDirection("uploaded") as "asc" | "desc"}
                        onClick={() => toggleSort("uploaded")}
                      />
                    </th>
                  ) : null}
                  {visibleColumns.has("size") ? (
                    <th className="pb-3">
                      <SortHeader
                        label="Size"
                        active={tableSort.startsWith("size")}
                        direction={sortDirection("size") as "asc" | "desc"}
                        onClick={() => toggleSort("size")}
                      />
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => {
                  const name = item.original_filename ?? item.storage_path;
                  const url = mediaPublicUrl(item.storage_path);
                  const checked = selectedIds.has(item.id);
                  return (
                    <tr key={item.id} className={cn("border-b border-border/70", checked && "bg-brand-softest/40")}>
                      <td className="py-3 pr-2 align-middle">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={checked}
                          onChange={() => toggleSelected(item.id)}
                          aria-label={`Select ${name}`}
                        />
                      </td>
                      {visibleColumns.has("title") ? (
                        <td className="py-3 pr-4 align-middle">
                          <Link
                            href={mediaDetailPath(item.id, adminRoutes, activeFolderId)}
                            className="flex min-w-[12rem] items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted">
                              {item.file_type === "image" ? (
                                <Image src={url} alt="" fill className="object-cover" sizes="56px" />
                              ) : item.file_type === "video" ? (
                                <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
                              ) : null}
                            </div>
                            <span className="truncate text-sm font-medium text-foreground hover:underline" title={name}>
                              {name}
                            </span>
                          </Link>
                        </td>
                      ) : null}
                      {visibleColumns.has("type") ? (
                        <td className="py-3 pr-4 align-middle text-sm text-muted-foreground">
                          {mediaTypeLabel(item.file_type)}
                        </td>
                      ) : null}
                      {visibleColumns.has("uploaded") ? (
                        <td className="py-3 pr-4 align-middle text-sm text-muted-foreground">
                          {formatMediaAge(item.created_at)}
                        </td>
                      ) : null}
                      {visibleColumns.has("size") ? (
                        <td className="py-3 align-middle text-sm tabular-nums text-muted-foreground">
                          {formatMediaFileSize(item.size_bytes)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filteredItems.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageIndex(0);
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {filteredItems.length === 0 ? "0–0 of 0" : `${pageStart + 1}–${pageEnd} of ${filteredItems.length}`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 px-0"
                disabled={safePageIndex <= 0}
                onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 px-0"
                disabled={safePageIndex >= pageCount - 1}
                onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <AddMediaToScreensDialog
        open={addToScreensMedia != null}
        onClose={() => setAddToScreensMedia(null)}
        mediaItems={addToScreensMedia ?? []}
        devices={devices}
        onConfirm={handleAddToScreens}
      />

      <MoveMediaToFolderDialog
        open={moveMediaTarget != null}
        onClose={() => setMoveMediaTarget(null)}
        mediaName={
          moveMediaTarget && moveMediaTarget.length > 1
            ? `${moveMediaTarget.length} files`
            : (moveMediaTarget?.[0]?.original_filename ?? "file")
        }
        mediaCount={moveMediaTarget?.length ?? 1}
        folders={mediaGroups}
        onConfirm={handleMoveToFolder}
      />

      <MediaDeleteDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget && deleteTarget.length > 1 ? `Delete ${deleteTarget.length} files?` : "Delete file?"}
        description="Selected files will be permanently removed from your library. Files used in playlists must be removed from those playlists first."
        confirmLabel={deleteTarget && deleteTarget.length > 1 ? "Delete files" : "Delete file"}
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
          setGroupBeingEdited(null);
          setGroupEditorMode("create");
          setCreateParentGroupId(null);
        }}
      />
    </div>
  );
}
