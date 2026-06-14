"use client";

import type { Media } from "@signage/types";
import { ArrowLeft, FileImage, FileVideo, FolderOpen, FolderPlus, Image as ImageIcon, Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { HeaderPrimaryButton } from "@/components/console/header-primary-button";
import { ListPageHeader } from "@/components/console/list-page-header";
import { ViewModeToggle } from "@/components/console/view-mode-toggle";
import { Button } from "@/components/ui/button";
import { ItemActionMenu } from "@/components/console/item-action-menu";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { PlanUsageMeter } from "@/components/plan/plan-usage-meter";
import { isStorageFull } from "@/lib/plan-quota";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { contentLibraryPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { DeviceGroupFolderCard } from "@/components/device-groups/device-group-folder-card";
import { MediaGroupEditorDialog } from "@/components/media-groups/media-group-editor-dialog";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { useAppRouter } from "@/hooks/use-app-router";
import { MEDIA_UPLOAD_ACCEPT } from "@/lib/upload-media";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { groupFilterLabel, parseGroupFilterFromSearchParam } from "@/lib/device-group-navigation";
import { cn } from "@/lib/utils";
import { useConsoleDataStore } from "@/stores/console-data-store";
import type { MediaGroupWithMembers } from "@/lib/console-sync";
import "@/components/device-groups/device-groups.css";

interface MediaLibraryProps {
  userId: string;
  /** When true, omits standalone page chrome (used inside Content workspace). */
  embedded?: boolean;
}

type TypeFilter = "all" | "image" | "video" | "unknown";

type MediaSort = "newest" | "oldest" | "name-asc" | "name-desc";

const SORT_OPTIONS: { id: MediaSort; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
];

function formatUpdatedAt(iso: string): string {
  return `Updated ${formatMediaAge(iso)}`;
}

function formatMediaAge(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 30) return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (day > 0) return day === 1 ? "yesterday" : `${day} days ago`;
  if (hr > 0) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  if (min > 0) return `${min} min ago`;
  return "just now";
}

function inferMediaOrientation(item: Media): "landscape" | "portrait" | null {
  const name = (item.original_filename ?? item.storage_path).toLowerCase();
  if (name.includes("portrait") || name.includes("vertical")) return "portrait";
  if (name.includes("landscape") || name.includes("horizontal")) return "landscape";
  return null;
}

function formatMediaMeta(item: Media): string {
  const typeLabel = item.file_type === "image" ? "Image" : item.file_type === "video" ? "Video" : "File";
  const orientation = inferMediaOrientation(item);
  const age = formatMediaAge(item.created_at);
  return orientation ? `${typeLabel} · ${orientation} · ${age}` : `${typeLabel} · ${age}`;
}

function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

const FILTER_ROWS: { id: TypeFilter; label: string; icon: typeof ImageIcon }[] = [
  { id: "all", label: "All", icon: FolderOpen },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "video", label: "Videos", icon: FileVideo },
  { id: "unknown", label: "Other", icon: FileImage },
];

const CONTENT_FOLDER_GRID =
  "device-group-folder-grid grid grid-cols-3 items-stretch gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";

function applyTypeFilter(list: Media[], typeFilter: TypeFilter): Media[] {
  if (typeFilter === "all") return list;
  return list.filter((m) => m.file_type === typeFilter);
}

function applySearchFilter(list: Media[], query: string): Media[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((m) => (m.original_filename ?? m.storage_path).toLowerCase().includes(q));
}

function sortMedia(list: Media[], sort: MediaSort): Media[] {
  const copy = [...list];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case "name-asc":
      return copy.sort((a, b) =>
        (a.original_filename ?? a.storage_path).localeCompare(b.original_filename ?? b.storage_path),
      );
    case "name-desc":
      return copy.sort((a, b) =>
        (b.original_filename ?? b.storage_path).localeCompare(a.original_filename ?? a.storage_path),
      );
    case "newest":
    default:
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

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
  const storageFull = plan != null && isStorageFull(plan);
  const { uploading, uploadFiles } = useMediaUpload(userId, { withDropzone: false });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [mediaSort, setMediaSort] = useState<MediaSort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "edit">("create");
  const [groupBeingEdited, setGroupBeingEdited] = useState<MediaGroupWithMembers | null>(null);

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

  const folderEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const entries = mediaGroups.map((group) => {
      const memberMedia = group.member_media_ids
        .map((id) => items.find((m) => m.id === id))
        .filter((m): m is Media => m != null);
      return { group, memberMedia, fileCount: memberMedia.length };
    });
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.group.name.toLowerCase().includes(q) ||
        entry.memberMedia.some((m) =>
          (m.original_filename ?? m.storage_path).toLowerCase().includes(q),
        ),
    );
  }, [mediaGroups, items, search]);

  const visibleFolderEntries = useMemo(
    () =>
      showSearchResultsGrid
        ? folderEntries.filter((e) => e.group.name.toLowerCase().includes(search.trim().toLowerCase()))
        : folderEntries,
    [folderEntries, showSearchResultsGrid, search],
  );

  const allLibraryMedia = useMemo(() => {
    return sortMedia(applyTypeFilter(items, typeFilter), mediaSort);
  }, [items, typeFilter, mediaSort]);

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
    return sortMedia(applySearchFilter(applyTypeFilter(groupFiltered, typeFilter), search), mediaSort);
  }, [groupFiltered, typeFilter, search, mediaSort]);

  const searchResultMedia = useMemo(() => {
    if (!showSearchResultsGrid) return [];
    return sortMedia(applyTypeFilter(applySearchFilter(items, search), typeFilter), mediaSort);
  }, [showSearchResultsGrid, items, search, typeFilter, mediaSort]);

  const activeGroupName = groupFilterLabel(groupFilter, activeGroup);
  const showBackButton = isInsideFolder;

  const pageTitle = useMemo(() => {
    if (isInsideFolder) return activeGroupName;
    if (showSearchResultsGrid) return "Search";
    return "Content";
  }, [activeGroupName, isInsideFolder, showSearchResultsGrid]);

  const typeFilterOptions = useMemo(
    () => FILTER_ROWS.map(({ id, label }) => ({ id, label })),
    [],
  );

  const mainPanelSubtitle = useMemo(() => {
    if (showFolderGrid) {
      const parts = [`${visibleFolderEntries.length} folder${visibleFolderEntries.length === 1 ? "" : "s"}`];
      parts.push(`${items.length} file${items.length === 1 ? "" : "s"}`);
      return parts.join(" · ");
    }
    if (showFolderContents) {
      return `${filtered.length} file${filtered.length === 1 ? "" : "s"}`;
    }
    if (showSearchResultsGrid) {
      return `${searchResultMedia.length} match${searchResultMedia.length === 1 ? "" : "es"}`;
    }
    return `${filtered.length} file${filtered.length === 1 ? "" : "s"}`;
  }, [
    filtered.length,
    items.length,
    searchResultMedia.length,
    showFolderContents,
    showFolderGrid,
    showSearchResultsGrid,
    visibleFolderEntries.length,
  ]);

  const openCreateGroup = useCallback(() => {
    setGroupEditorMode("create");
    setGroupBeingEdited(null);
    setGroupEditorOpen(true);
  }, []);

  const openEditGroup = useCallback((group: MediaGroupWithMembers) => {
    setGroupEditorMode("edit");
    setGroupBeingEdited(group);
    setGroupEditorOpen(true);
  }, []);

  const handleBack = useCallback(() => {
    navigateToGroup("all");
  }, [navigateToGroup]);

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
            searchPlaceholder="Search files…"
            filterOptions={typeFilterOptions}
            activeFilterId={typeFilter}
            onFilterChange={(id) => setTypeFilter(id as TypeFilter)}
            sortOptions={SORT_OPTIONS}
            activeSortId={mediaSort}
            onSortChange={(id) => setMediaSort(id as MediaSort)}
            toolbarStart={
              !readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={openCreateGroup}
                >
                  <FolderPlus className="h-4 w-4" aria-hidden />
                  New folder
                </Button>
              ) : undefined
            }
            center={
              plan ? (
                <PlanUsageMeter
                  variant="storage"
                  used={plan.storageUsedBytes}
                  limit={plan.storageLimitBytes}
                  layout="inline"
                />
              ) : undefined
            }
            trailing={<ViewModeToggle view={view} onViewChange={setView} />}
          />

          {!readOnly && storageFull ? (
            <div className="border-b border-border px-4 py-2.5 text-xs leading-relaxed text-red-900 dark:text-red-100 sm:px-5">
              Storage is full. Delete files from your library or ask your administrator to increase your plan.
            </div>
          ) : null}

          <div className="flex-1 p-4 sm:p-5">
            {showFolderGrid ? (
              visibleFolderEntries.length > 0 ? (
                <div className="space-y-8">
                  <ul className={CONTENT_FOLDER_GRID}>
                    {visibleFolderEntries.map(({ group, fileCount }) => (
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
                      <MediaFileGrid
                        items={allLibraryMedia}
                        view={view}
                        readOnly={readOnly}
                        onRemove={(item) => void removeMedia(item)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : items.length > 0 ? (
                <MediaFileGrid
                  items={allLibraryMedia}
                  view={view}
                  readOnly={readOnly}
                  onRemove={(item) => void removeMedia(item)}
                />
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
              searchResultMedia.length === 0 && visibleFolderEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No files match</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">Try another search term or filter.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {visibleFolderEntries.length > 0 ? (
                    <div>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        Folders
                      </p>
                      <ul className={CONTENT_FOLDER_GRID}>
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
                    <div className={visibleFolderEntries.length > 0 ? "space-y-4 border-t border-border pt-6" : ""}>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        All media
                      </p>
                      <MediaFileGrid
                        items={searchResultMedia}
                        view={view}
                        readOnly={readOnly}
                        onRemove={(item) => void removeMedia(item)}
                      />
                    </div>
                  ) : null}
                </div>
              )
            ) : showFolderContents ? (
              filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">This folder is empty</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Assign files from the folder editor, or upload new assets.
                  </p>
                </div>
              ) : (
                <MediaFileGrid
                  items={filtered}
                  view={view}
                  readOnly={readOnly}
                  onRemove={(item) => void removeMedia(item)}
                />
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
              <MediaFileGrid
                items={filtered}
                view={view}
                readOnly={readOnly}
                onRemove={(item) => void removeMedia(item)}
              />
            )}
          </div>
        </div>
      </div>

      <MediaGroupEditorDialog
        open={groupEditorOpen}
        mode={groupEditorMode}
        ownerId={userId}
        group={groupBeingEdited}
        media={items}
        onClose={() => setGroupEditorOpen(false)}
      />
    </div>
  );
}

function MediaFileGrid({
  items,
  view,
  readOnly,
  onRemove,
}: {
  items: Media[];
  view: "grid" | "list";
  readOnly: boolean;
  onRemove: (item: Media) => void;
}) {
  if (view === "grid") {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} onRemove={readOnly ? undefined : () => onRemove(item)} />
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((item) => (
        <MediaListRow key={item.id} item={item} onRemove={readOnly ? undefined : () => onRemove(item)} />
      ))}
    </ul>
  );
}

function MediaCard({
  item,
  onRemove,
}: {
  item: Media;
  onRemove?: () => void;
}) {
  const url = mediaPublicUrl(item.storage_path);
  const name = item.original_filename ?? item.storage_path;
  const durationLabel = item.file_type === "video" ? formatVideoDuration(item.duration_seconds) : null;
  const menuItems = [
    { label: "Open file", onClick: () => window.open(url, "_blank", "noopener,noreferrer") },
    ...(onRemove ? [{ label: "Delete file", onClick: onRemove, destructive: true as const }] : []),
  ];

  return (
    <li className="group flex flex-col rounded-lg border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-lg bg-muted/70">
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
      <div className="flex items-start gap-1 border-t border-border/60 bg-card p-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground" title={name}>
            {name}
          </p>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">{formatMediaMeta(item)}</p>
        </div>
        <ItemActionMenu ariaLabel={`Actions for ${name}`} items={menuItems} className="shrink-0" />
      </div>
    </li>
  );
}

function MediaListRow({
  item,
  onRemove,
}: {
  item: Media;
  onRemove?: () => void;
}) {
  const url = mediaPublicUrl(item.storage_path);
  const name = item.original_filename ?? item.storage_path;

  return (
    <li className="flex items-center gap-4 px-3 py-3 transition-colors hover:bg-muted/40">
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
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Open
        </a>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="text-xs font-medium text-destructive hover:underline">
            Delete
          </button>
        ) : null}
      </div>
    </li>
  );
}
