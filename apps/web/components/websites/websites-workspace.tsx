"use client";

import type { Website } from "@signage/types";
import { Globe, ListPlus, ListX, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HeaderPrimaryButton } from "@/components/console/header-primary-button";
import { CONSOLE_PANEL_CHROME } from "@/components/console/console-panel";
import { ListPageHeader } from "@/components/console/list-page-header";
import { cn } from "@/lib/utils";
import { ItemActionMenu, type ActionMenuItem } from "@/components/console/item-action-menu";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { websiteDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { MediaDeleteDialog } from "@/components/media/media-delete-dialog";
import { WebsiteEditorDialog } from "@/components/websites/website-editor-dialog";
import { WebsitePreviewFrame } from "@/components/websites/website-preview-frame";
import { AddWebsiteToScreensDialog } from "@/components/websites/add-website-to-screens-dialog";
import {
  addWebsitesToDevicePlaylists,
  countWebsitePlaylistReferences,
  removeWebsiteFromAllPlaylists,
} from "@/lib/website-playlist-ops";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import {
  applyWebsiteSearchFilter,
  formatWebsiteMeta,
  sortWebsiteList,
  type WebsiteSort,
} from "@/lib/website-display";

const SORT_OPTIONS: { id: WebsiteSort; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
];

const WEBSITE_GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function WebsitesWorkspace({ userId, readOnly = false }: { userId: string; readOnly?: boolean }) {
  const adminRoutes = useAdminClientRoutes();
  const adminStaff = useOptionalAdminStaff();
  const effectiveReadOnly = readOnly || (adminStaff != null && !adminStaff.canWrite);
  const { syncNow } = useConsoleSync();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const websites = useConsoleDataStore((s) => s.websites);
  const devices = useConsoleDataStore((s) => s.devices);
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);
  const websitePlaylistRefCounts = useConsoleDataStore((s) => s.websitePlaylistRefCounts);

  const [search, setSearch] = useState("");
  const [websiteSort, setWebsiteSort] = useState<WebsiteSort>("newest");
  const [editorOpen, setEditorOpen] = useState(false);
  const [addToScreensTarget, setAddToScreensTarget] = useState<Website | Website[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Website | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const filtered = useMemo(
    () => sortWebsiteList(applyWebsiteSearchFilter(websites, search), websiteSort),
    [websites, search, websiteSort],
  );

  function buildMenu(website: Website): ActionMenuItem[] {
    const playlistRefs = countWebsitePlaylistReferences(websitePlaylistRefCounts, website.id);
    return [
      {
        label: "Add to screens",
        icon: <ListPlus className="h-4 w-4 shrink-0" aria-hidden />,
        disabled: effectiveReadOnly,
        onClick: () => setAddToScreensTarget(website),
      },
      {
        label: "Remove from all playlists",
        icon: <ListX className="h-4 w-4 shrink-0" aria-hidden />,
        disabled: effectiveReadOnly || playlistRefs === 0,
        onClick: () => {
          void (async () => {
            const { removedCount, error } = await removeWebsiteFromAllPlaylists(supabase, website.id);
            if (error) {
              toast.error(error);
              return;
            }
            toast.success(removedCount > 0 ? `Removed from ${removedCount} playlist item(s).` : "Not in any playlists.");
            await syncNow();
          })();
        },
      },
      {
        label: "Delete",
        icon: <Trash2 className="h-4 w-4 shrink-0" aria-hidden />,
        destructive: true,
        disabled: effectiveReadOnly,
        onClick: () => setDeleteTarget(website),
      },
    ];
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteInProgress(true);
    try {
      const response = await fetch("/api/websites/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id, ownerId: userId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Unable to delete website.");
        return;
      }
      toast.success(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      await syncNow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete website.");
    } finally {
      setDeleteInProgress(false);
    }
  }

  return (
    <>
      <div className={cn("flex min-h-[min(70vh,720px)] flex-col", CONSOLE_PANEL_CHROME)}>
        <ListPageHeader
          title="Websites"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search websites"
          sortOptions={SORT_OPTIONS}
          activeSortId={websiteSort}
          onSortChange={(id) => setWebsiteSort(id as WebsiteSort)}
          primaryAction={
            effectiveReadOnly ? undefined : (
              <HeaderPrimaryButton
                type="button"
                onClick={() => setEditorOpen(true)}
                label="Add Website"
                icon={<Plus className="h-4 w-4" aria-hidden />}
              />
            )
          }
        />

        <div className="flex-1 p-4 sm:p-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
              <Globe className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">
                {search.trim() ? "No websites match your search" : "No websites yet"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {search.trim()
                  ? "Try a different search term."
                  : "Add a URL, paste HTML, or upload an HTML file to display on your screens."}
              </p>
            </div>
          ) : (
            <div className={WEBSITE_GRID}>
              {filtered.map((website) => (
                <article
                  key={website.id}
                  className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <Link href={websiteDetailPath(website.id, adminRoutes)} className="block">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <WebsitePreviewFrame website={website} className="h-full w-full" />
                      <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/70 text-white">
                        <Globe className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-start justify-between gap-2 px-3 py-3">
                    <Link href={websiteDetailPath(website.id, adminRoutes)} className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-foreground">{website.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatWebsiteMeta(website)}</p>
                    </Link>
                    <ItemActionMenu ariaLabel={`Actions for ${website.name}`} items={buildMenu(website)} className="shrink-0" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <WebsiteEditorDialog
        open={editorOpen}
        ownerId={userId}
        onClose={() => setEditorOpen(false)}
        onCreated={syncNow}
      />

      <AddWebsiteToScreensDialog
        open={addToScreensTarget != null}
        onClose={() => setAddToScreensTarget(null)}
        websiteItems={Array.isArray(addToScreensTarget) ? addToScreensTarget : addToScreensTarget ? [addToScreensTarget] : []}
        devices={devices}
        onConfirm={async (deviceIds, options) => {
          const items = Array.isArray(addToScreensTarget)
            ? addToScreensTarget
            : addToScreensTarget
              ? [addToScreensTarget]
              : [];
          const selectedDevices = devices.filter((device) => deviceIds.includes(device.id));
          const { addedCount, error } = await addWebsitesToDevicePlaylists(
            supabase,
            userId,
            items,
            selectedDevices,
            playlistItemsByPlaylistId,
            options,
          );
          if (error) {
            toast.error(error);
            return;
          }
          toast.success(`Added to ${addedCount} playlist item(s).`);
          await syncNow();
        }}
      />

      <MediaDeleteDialog
        open={deleteTarget != null}
        title="Delete website?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from your library. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete website"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isConfirming={deleteInProgress}
      />
    </>
  );
}
