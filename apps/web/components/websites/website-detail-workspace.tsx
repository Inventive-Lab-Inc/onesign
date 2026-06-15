"use client";

import type { Website } from "@signage/types";
import { ListPlus, ListX, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { websitesListPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { ItemActionMenu, type ActionMenuItem } from "@/components/console/item-action-menu";
import { MediaDeleteDialog } from "@/components/media/media-delete-dialog";
import { AddWebsiteToScreensDialog } from "@/components/websites/add-website-to-screens-dialog";
import { WebsitePreviewFrame } from "@/components/websites/website-preview-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppRouter } from "@/hooks/use-app-router";
import {
  fromDatetimeLocalValue,
  normalizeMediaTags,
  toDatetimeLocalValue,
} from "@/lib/media-information";
import {
  addWebsitesToDevicePlaylists,
  countWebsitePlaylistReferences,
  removeWebsiteFromAllPlaylists,
} from "@/lib/website-playlist-ops";
import { buildWebsiteInformationRows } from "@/lib/website-display";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";

const ZOOM_OPTIONS = [50, 75, 100, 125, 150, 200];

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

export function WebsiteDetailWorkspace({
  websiteId,
  ownerId,
  readOnly = false,
}: {
  websiteId: string;
  ownerId: string;
  readOnly?: boolean;
}) {
  const adminRoutes = useAdminClientRoutes();
  const adminStaff = useOptionalAdminStaff();
  const router = useAppRouter();
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();

  const website = useConsoleDataStore((s) => s.websites.find((item) => item.id === websiteId));
  const devices = useConsoleDataStore((s) => s.devices);
  const playlistItemsByPlaylistId = useConsoleDataStore((s) => s.playlistItemsByPlaylistId);
  const websitePlaylistRefCounts = useConsoleDataStore((s) => s.websitePlaylistRefCounts);
  const patchWebsite = useConsoleDataStore((s) => s.patchWebsite);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [displayFrom, setDisplayFrom] = useState("");
  const [displayUntil, setDisplayUntil] = useState("");
  const [initializedForId, setInitializedForId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addToScreensOpen, setAddToScreensOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const effectiveReadOnly = readOnly || adminStaff?.canWrite === false;
  const backHref = websitesListPath(adminRoutes);

  useEffect(() => {
    if (!website || initializedForId === website.id) return;
    setInitializedForId(website.id);
    setTitle(website.name);
    setUrl(website.url ?? "");
    setDescription(website.description ?? "");
    setTags(normalizeMediaTags(website.tags ?? []));
    setZoomLevel(website.zoom_level);
    setDisplayFrom(toDatetimeLocalValue(website.display_from));
    setDisplayUntil(toDatetimeLocalValue(website.display_until));
  }, [website, initializedForId]);

  const infoRows = useMemo(() => (website ? buildWebsiteInformationRows(website) : []), [website]);

  const hasChanges = useMemo(() => {
    if (!website) return false;
    return (
      title.trim() !== website.name ||
      (website.source_type === "url" && url.trim() !== (website.url ?? "")) ||
      description.trim() !== (website.description ?? "").trim() ||
      JSON.stringify(tags) !== JSON.stringify(normalizeMediaTags(website.tags ?? [])) ||
      zoomLevel !== website.zoom_level ||
      displayFrom !== toDatetimeLocalValue(website.display_from) ||
      displayUntil !== toDatetimeLocalValue(website.display_until)
    );
  }, [website, title, url, description, tags, zoomLevel, displayFrom, displayUntil]);

  const addTag = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setTags((current) => {
      const next = normalizeMediaTags([...current, trimmed]);
      return next.length === current.length ? current : next;
    });
    setTagDraft("");
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags((current) => current.filter((entry) => entry !== tag));
  }, []);

  const actionItems = useMemo((): ActionMenuItem[] => {
    if (!website) return [];
    const playlistRefs = countWebsitePlaylistReferences(websitePlaylistRefCounts, website.id);
    return [
      {
        label: "Add to screens",
        icon: <ListPlus className="h-4 w-4 shrink-0" aria-hidden />,
        disabled: effectiveReadOnly,
        onClick: () => setAddToScreensOpen(true),
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
        onClick: () => setDeleteOpen(true),
      },
    ];
  }, [website, websitePlaylistRefCounts, effectiveReadOnly, supabase, syncNow]);

  const saveChanges = useCallback(async () => {
    if (!website || effectiveReadOnly || !hasChanges) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/websites/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: website.id,
          ownerId,
          name: trimmedTitle,
          url: website.source_type === "url" ? url : undefined,
          description: description.trim() || null,
          tags,
          zoom_level: zoomLevel,
          display_from: fromDatetimeLocalValue(displayFrom),
          display_until: fromDatetimeLocalValue(displayUntil),
        }),
      });

      const payload = (await response.json()) as { error?: string; website?: Website };
      if (!response.ok) {
        toast.error(payload.error ?? "Unable to save changes.");
        return;
      }

      if (payload.website) {
        patchWebsite(website.id, payload.website);
      }
      toast.success("Changes saved.");
      await syncNow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }, [
    website,
    effectiveReadOnly,
    hasChanges,
    title,
    url,
    description,
    tags,
    zoomLevel,
    displayFrom,
    displayUntil,
    ownerId,
    patchWebsite,
    syncNow,
  ]);

  async function confirmDelete() {
    if (!website) return;
    setDeleteInProgress(true);
    try {
      const response = await fetch("/api/websites/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: website.id, ownerId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Unable to delete website.");
        return;
      }
      toast.success(`${website.name} deleted.`);
      router.push(backHref);
      await syncNow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete website.");
    } finally {
      setDeleteInProgress(false);
    }
  }

  if (!website) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BackNavLink href={backHref} label="Websites" />
          <h1 className="truncate text-2xl font-semibold text-foreground">{website.name}</h1>
        </div>
        <ItemActionMenu ariaLabel="Website actions" items={actionItems} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
            <WebsitePreviewFrame website={website} className="aspect-[16/9] min-h-[320px] w-full" zoomLevel={zoomLevel} />
          </div>
          <p className="text-xs text-muted-foreground">
            This preview indicates how this site will look on a standard HD screen.
          </p>
          <InfoRows rows={infoRows} />
        </section>

        <aside className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          {website.source_type === "url" ? (
            <div className="space-y-2">
              <Label htmlFor="website-url">URL *</Label>
              <Input
                id="website-url"
                value={url}
                disabled={effectiveReadOnly}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="website-title">Title *</Label>
            <Input
              id="website-title"
              value={title}
              disabled={effectiveReadOnly}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website-description">Description</Label>
            <textarea
              id="website-description"
              value={description}
              disabled={effectiveReadOnly}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website-tags">Tags</Label>
            <Input
              id="website-tags"
              value={tagDraft}
              disabled={effectiveReadOnly}
              placeholder="Type and press enter"
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(tagDraft);
                }
              }}
            />
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={effectiveReadOnly}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="website-zoom">Zoom level</Label>
            <select
              id="website-zoom"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={zoomLevel}
              disabled={effectiveReadOnly}
              onChange={(event) => setZoomLevel(Number(event.target.value))}
            >
              {ZOOM_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Set the zoom level to adjust how the site displays on large screens.
            </p>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Schedule</p>
            <div className="space-y-2">
              <Label htmlFor="website-start">Start date &amp; time</Label>
              <Input
                id="website-start"
                type="datetime-local"
                value={displayFrom}
                disabled={effectiveReadOnly}
                onChange={(event) => setDisplayFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-expiry">Expiry date &amp; time</Label>
              <Input
                id="website-expiry"
                type="datetime-local"
                value={displayUntil}
                disabled={effectiveReadOnly}
                onChange={(event) => setDisplayUntil(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Website will not show on any screens before the start date or after the expiry date. Leave blank to always show.
            </p>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={effectiveReadOnly || !hasChanges || saving}
            onClick={() => void saveChanges()}
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </aside>
      </div>

      <AddWebsiteToScreensDialog
        open={addToScreensOpen}
        onClose={() => setAddToScreensOpen(false)}
        websiteItems={[website]}
        devices={devices}
        onConfirm={async (deviceIds, options) => {
          const selectedDevices = devices.filter((device) => deviceIds.includes(device.id));
          const { addedCount, error } = await addWebsitesToDevicePlaylists(
            supabase,
            ownerId,
            [website],
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
        open={deleteOpen}
        title="Delete website?"
        description={`"${website.name}" will be removed from your library. This cannot be undone.`}
        confirmLabel="Delete website"
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        isConfirming={deleteInProgress}
      />
    </div>
  );
}
