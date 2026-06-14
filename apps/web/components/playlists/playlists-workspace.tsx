"use client";

import type { Playlist, PlaylistItemWithMedia } from "@signage/types";
import { ArrowLeft, ListVideo, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppRouter } from "@/hooks/use-app-router";
import { useCallback, useMemo, useState } from "react";
import {
  contentPlaylistsPath,
  parseContentView,
  playlistDetailPath,
  playlistsListPath,
  useAdminClientRoutes,
} from "@/components/admin/admin-client-route-context";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { ContentViewTabs } from "@/components/content/content-view-tabs";
import { CreatePlaylistForm } from "@/components/create-playlist-form";
import { MediaLibrary } from "@/components/media-library";
import { DeviceGroupFolderCard, GroupFolderCreateCard } from "@/components/device-groups/device-group-folder-card";
import { PlaylistGroupEditorDialog } from "@/components/playlist-groups/playlist-group-editor-dialog";
import { Input } from "@/components/ui/input";
import type { PlaylistGroupWithMembers } from "@/lib/console-sync";
import { groupFilterLabel, parseGroupFilterFromSearchParam } from "@/lib/device-group-navigation";
import { formatPlaylistClockLabel } from "@/lib/playlist-timing";
import { cn } from "@/lib/utils";
import { useConsoleDataStore } from "@/stores/console-data-store";
import "@/components/device-groups/device-groups.css";

export function PlaylistsWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useAppRouter();
  const adminRoutes = useAdminClientRoutes();
  const adminStaff = useOptionalAdminStaff();
  const readOnly = adminStaff != null && !adminStaff.canWrite;
  const playlistsHomePath = adminRoutes?.playlistsPath ?? "/playlists";
  const contentView = parseContentView(searchParams);
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const playlists = useConsoleDataStore((s) => s.playlists) as Playlist[];
  const playlistGroups = useConsoleDataStore((s) => s.playlistGroups) as PlaylistGroupWithMembers[];
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);
  const [query, setQuery] = useState("");
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "edit">("create");
  const [groupBeingEdited, setGroupBeingEdited] = useState<PlaylistGroupWithMembers | null>(null);

  const activePlaylistId = useMemo(() => {
    if (pathname === playlistsHomePath) return null;
    if (!pathname.startsWith(`${playlistsHomePath}/`)) return null;
    const id = pathname.slice(playlistsHomePath.length + 1).split("/")[0];
    return id && id !== "new" ? id : null;
  }, [pathname, playlistsHomePath]);

  const isLibraryView = contentView === "library" && activePlaylistId === null;
  const isPlaylistsHome = activePlaylistId === null;

  const groupFilter = useMemo(
    () => parseGroupFilterFromSearchParam(searchParams.get("group"), playlistGroups),
    [searchParams, playlistGroups],
  );

  const activeGroup = useMemo(
    () => (groupFilter !== "all" && groupFilter !== "ungrouped"
      ? playlistGroups.find((g) => g.id === groupFilter) ?? null
      : null),
    [playlistGroups, groupFilter],
  );

  const navigateToGroup = useCallback(
    (filter: typeof groupFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "playlists");
      if (filter === "all") {
        params.delete("group");
      } else {
        params.set("group", filter);
      }
      const qs = params.toString();
      router.push(qs ? `${playlistsHomePath}?${qs}` : `${playlistsHomePath}?view=playlists`);
    },
    [playlistsHomePath, router, searchParams],
  );

  const backNavLabel = "Back to folders";
  const activeGroupName = groupFilterLabel(groupFilter, activeGroup);

  const groupedPlaylistIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of playlistGroups) {
      for (const playlistId of group.member_playlist_ids) {
        ids.add(playlistId);
      }
    }
    return ids;
  }, [playlistGroups]);

  const sorted = useMemo(
    () => [...playlists].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [playlists],
  );

  const groupFiltered = useMemo(() => {
    if (groupFilter === "ungrouped") {
      return sorted.filter((p) => !groupedPlaylistIds.has(p.id));
    }
    if (groupFilter !== "all") {
      const memberIds = new Set(activeGroup?.member_playlist_ids ?? []);
      return sorted.filter((p) => memberIds.has(p.id));
    }
    return sorted;
  }, [sorted, groupFilter, groupedPlaylistIds, activeGroup]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupFiltered;
    return groupFiltered.filter((p) => p.name.toLowerCase().includes(q));
  }, [query, groupFiltered]);

  const folderEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entries = playlistGroups.map((group) => {
      const memberPlaylists = group.member_playlist_ids
        .map((id) => playlists.find((p) => p.id === id))
        .filter((p): p is Playlist => p != null);
      return { group, memberPlaylists, playlistCount: memberPlaylists.length };
    });
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.group.name.toLowerCase().includes(q) ||
        entry.memberPlaylists.some((p) => p.name.toLowerCase().includes(q)),
    );
  }, [playlistGroups, playlists, query]);

  const isLibraryRoot = groupFilter === "all" || groupFilter === "ungrouped";
  const isInsideFolder = !isLibraryRoot;

  const ungroupedPlaylists = useMemo(() => {
    const items = playlists.filter((p) => !groupedPlaylistIds.has(p.id));
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => p.name.toLowerCase().includes(q));
  }, [playlists, groupedPlaylistIds, query]);

  const showFolderGrid = isPlaylistsHome && isLibraryRoot && !query.trim() && contentView === "playlists";
  const showSearchResultsGrid = isPlaylistsHome && isLibraryRoot && query.trim().length > 0 && contentView === "playlists";
  const showFolderContents = isPlaylistsHome && isInsideFolder && !query.trim() && contentView === "playlists";

  const searchResultPlaylists = useMemo(() => {
    if (!showSearchResultsGrid) return [];
    const q = query.trim().toLowerCase();
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }, [showSearchResultsGrid, query, playlists]);

  const ungroupedSearchPlaylists = useMemo(
    () => searchResultPlaylists.filter((p) => !groupedPlaylistIds.has(p.id)),
    [searchResultPlaylists, groupedPlaylistIds],
  );

  const groupedSearchPlaylists = useMemo(
    () => searchResultPlaylists.filter((p) => groupedPlaylistIds.has(p.id)),
    [searchResultPlaylists, groupedPlaylistIds],
  );

  const visibleFolderEntries = useMemo(
    () => (showSearchResultsGrid
      ? folderEntries.filter((e) => e.group.name.toLowerCase().includes(query.trim().toLowerCase()))
      : folderEntries),
    [folderEntries, showSearchResultsGrid, query],
  );

  const hasUngroupedPlaylists = ungroupedPlaylists.length > 0;

  const playlistsBackHref = playlistsListPath(adminRoutes, activePlaylistId ? searchParams.get("group") : null);

  const activePlaylist = useMemo(
    () => (activePlaylistId ? playlists.find((p) => p.id === activePlaylistId) : null),
    [activePlaylistId, playlists],
  );

  const mainPanelSubtitle = useMemo(() => {
    if (activePlaylist) {
      const items = playlistItemsByPlaylistId[activePlaylist.id] ?? [];
      return `${items.length} item${items.length === 1 ? "" : "s"} · ${formatPlaylistClockLabel(items)}`;
    }
    if (showFolderGrid) {
      const parts = [`${visibleFolderEntries.length} folder${visibleFolderEntries.length === 1 ? "" : "s"}`];
      if (hasUngroupedPlaylists) {
        parts.push(`${ungroupedPlaylists.length} ungrouped`);
      }
      parts.push(`${playlists.length} playlist${playlists.length === 1 ? "" : "s"}`);
      return parts.join(" · ");
    }
    if (showFolderContents) {
      return `${filtered.length} playlist${filtered.length === 1 ? "" : "s"}`;
    }
    const count = playlists.length;
    if (count === 0) return "No playlists yet";
    return `${count} playlist${count === 1 ? "" : "s"}`;
  }, [
    activePlaylist,
    filtered.length,
    playlistItemsByPlaylistId,
    playlists.length,
    showFolderContents,
    showFolderGrid,
    hasUngroupedPlaylists,
    ungroupedPlaylists.length,
    visibleFolderEntries.length,
  ]);

  const openCreateGroup = useCallback(() => {
    setGroupEditorMode("create");
    setGroupBeingEdited(null);
    setGroupEditorOpen(true);
  }, []);

  const openEditGroup = useCallback((group: PlaylistGroupWithMembers) => {
    setGroupEditorMode("edit");
    setGroupBeingEdited(group);
    setGroupEditorOpen(true);
  }, []);

  const showBackButton = isInsideFolder || activePlaylistId !== null;

  const handleBack = useCallback(() => {
    if (activePlaylistId) {
      router.push(playlistsBackHref);
      return;
    }
    navigateToGroup("all");
  }, [activePlaylistId, navigateToGroup, playlistsBackHref, router]);

  if (!ownerId) {
    return (
      <div className="flex min-h-[min(70vh,720px)] flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="hidden w-56 shrink-0 space-y-4 xl:w-60 lg:block">
          <div className="h-[4.25rem] animate-pulse rounded-xl bg-muted" />
          <div className="h-36 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
        </div>
        <div className="min-h-[240px] flex-1 animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!activePlaylistId ? (
        <ContentViewTabs
          activeView={contentView}
          groupId={groupFilter !== "all" && groupFilter !== "ungrouped" ? groupFilter : null}
        />
      ) : null}

      {isLibraryView ? (
        <MediaLibrary userId={ownerId} embedded />
      ) : (
    <div className="flex min-h-[min(70vh,720px)] flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-56 xl:w-60">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search playlists…"
              className="h-9 border-border bg-background pl-8 text-sm"
              aria-label="Search playlists"
            />
          </div>
        </div>

        {!readOnly ? (
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              New playlist
            </p>
            <CreatePlaylistForm ownerId={ownerId} variant="cta" />
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
              Opens the editor right away. Add clips from your library, then assign playlists to screens.
            </p>
          </div>
        ) : null}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex min-h-full flex-col rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                {showBackButton ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    aria-label={activePlaylistId ? "Back to playlists" : backNavLabel}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong shadow-sm transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-brand-onDark"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2.25} />
                  </button>
                ) : null}
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                  <button
                    type="button"
                    onClick={() =>
                      activePlaylistId
                        ? router.push(playlistsListPath(adminRoutes, null))
                        : navigateToGroup("all")
                    }
                    className={cn(
                      "transition-colors",
                      !activePlaylistId && isLibraryRoot && contentView === "playlists"
                        ? "text-foreground"
                        : "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
                    )}
                  >
                    Content
                  </button>
                  {activePlaylist ? (
                    <>
                      <span className="text-muted-foreground/70">/</span>
                      <button
                        type="button"
                        onClick={() => router.push(contentPlaylistsPath(adminRoutes, null))}
                        className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                      >
                        Playlists
                      </button>
                      <span className="text-muted-foreground/70">/</span>
                      <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">
                        {activePlaylist.name}
                      </span>
                    </>
                  ) : isInsideFolder ? (
                    <>
                      <span className="text-muted-foreground/70">/</span>
                      <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">
                        {activeGroupName}
                      </span>
                    </>
                  ) : showFolderGrid ? (
                    <>
                      <span className="text-muted-foreground/70">/</span>
                      <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">Folders</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground/70">/</span>
                      <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">Playlists</span>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{mainPanelSubtitle}</p>
            </div>
          </div>
          <div className="flex-1 p-4 sm:p-5">
            {activePlaylistId ? (
              children
            ) : showFolderGrid ? (
              <div className="space-y-8">
                <ul className="device-group-folder-grid grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {visibleFolderEntries.map(({ group, playlistCount }) => (
                    <DeviceGroupFolderCard
                      key={group.id}
                      name={group.name}
                      accentColor={group.accent_color}
                      itemCount={playlistCount}
                      itemLabel="playlist"
                      previewIcon={ListVideo}
                      onOpen={() => navigateToGroup(group.id)}
                      onEdit={readOnly ? undefined : () => openEditGroup(group)}
                    />
                  ))}
                  {!readOnly ? (
                    <GroupFolderCreateCard onClick={openCreateGroup} hint="Organize playlists" />
                  ) : null}
                </ul>
                {hasUngroupedPlaylists ? (
                  <div className="space-y-4 border-t border-border pt-8">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Ungrouped</p>
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {ungroupedPlaylists.map((playlist) => (
                        <PlaylistGridCard
                          key={playlist.id}
                          playlist={playlist}
                          href={playlistDetailPath(playlist.id, adminRoutes, null)}
                          items={playlistItemsByPlaylistId[playlist.id] ?? []}
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : showSearchResultsGrid ? (
              searchResultPlaylists.length === 0 && visibleFolderEntries.length === 0 && !readOnly ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No playlists match</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">Try another search term.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {visibleFolderEntries.length > 0 || !readOnly ? (
                    <div>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Folders</p>
                      <ul className="device-group-folder-grid grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {visibleFolderEntries.map(({ group, playlistCount }) => (
                          <DeviceGroupFolderCard
                            key={group.id}
                            name={group.name}
                            accentColor={group.accent_color}
                            itemCount={playlistCount}
                            itemLabel="playlist"
                            previewIcon={ListVideo}
                            onOpen={() => {
                              setQuery("");
                              navigateToGroup(group.id);
                            }}
                            onEdit={readOnly ? undefined : () => openEditGroup(group)}
                          />
                        ))}
                        {!readOnly ? (
                          <GroupFolderCreateCard onClick={openCreateGroup} hint="Organize playlists" />
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                  {ungroupedSearchPlaylists.length > 0 ? (
                    <div className="space-y-4 border-t border-border pt-6">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Ungrouped</p>
                      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {ungroupedSearchPlaylists.map((playlist) => (
                          <PlaylistGridCard
                            key={playlist.id}
                            playlist={playlist}
                            href={playlistDetailPath(playlist.id, adminRoutes, null)}
                            items={playlistItemsByPlaylistId[playlist.id] ?? []}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {groupedSearchPlaylists.length > 0 ? (
                    <div className={ungroupedSearchPlaylists.length > 0 ? "space-y-4 border-t border-border pt-6" : ""}>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">In folders</p>
                      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {groupedSearchPlaylists.map((playlist) => (
                          <PlaylistGridCard
                            key={playlist.id}
                            playlist={playlist}
                            href={playlistDetailPath(playlist.id, adminRoutes, null)}
                            items={playlistItemsByPlaylistId[playlist.id] ?? []}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )
            ) : showFolderContents ? (
              filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">This folder is empty</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Assign playlists from the folder editor, or create a new one.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((playlist) => (
                    <PlaylistGridCard
                      key={playlist.id}
                      playlist={playlist}
                      href={playlistDetailPath(playlist.id, adminRoutes, groupFilter)}
                      items={playlistItemsByPlaylistId[playlist.id] ?? []}
                    />
                  ))}
                </ul>
              )
            ) : (
              children
            )}
          </div>
        </div>
      </div>

      {ownerId ? (
        <PlaylistGroupEditorDialog
          open={groupEditorOpen}
          mode={groupEditorMode}
          ownerId={ownerId}
          group={groupBeingEdited}
          playlists={playlists}
          onClose={() => setGroupEditorOpen(false)}
        />
      ) : null}
    </div>
      )}
    </div>
  );
}

function PlaylistGridCard({
  playlist,
  href,
  items,
}: {
  playlist: Playlist;
  href: string;
  items: PlaylistItemWithMedia[];
}) {
  const timingLabel = formatPlaylistClockLabel(items);
  return (
    <li>
      <Link
        href={href}
        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-br from-muted/80 to-muted/40 px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border">
            <ListVideo className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{playlist.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {items.length} item{items.length === 1 ? "" : "s"} · {timingLabel}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
