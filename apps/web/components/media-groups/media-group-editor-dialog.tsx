"use client";

import type { Media } from "@signage/types";
import { Check, FileImage, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaGroupWithMembers } from "@/lib/console-sync";
import { DEFAULT_GROUP_COLOR, DEVICE_GROUP_COLORS, resolveGroupColor } from "@/lib/device-group-colors";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useWorkspaceOptional } from "@/components/workspace/workspace-provider";
import { scopedContentRow } from "@/lib/workspace/content-scope";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { useConsoleDataStore } from "@/stores/console-data-store";
import "@/components/device-groups/device-groups.css";

type MediaGroupEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  ownerId: string;
  group: MediaGroupWithMembers | null;
  media: Media[];
  parentGroupId?: string | null;
  onClose: () => void;
};

function MediaFolderFileThumb({ item }: { item: Media }) {
  const url = mediaPublicUrl(item.storage_path);

  return (
    <span className="relative aspect-[16/10] w-12 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/70">
      {item.file_type === "image" ? (
        <Image src={url} alt="" fill className="object-contain p-0.5" sizes="48px" />
      ) : item.file_type === "video" ? (
        <video src={url} muted playsInline preload="metadata" className="h-full w-full object-contain" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
          <FileImage className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </span>
      )}
    </span>
  );
}

export function MediaGroupEditorDialog({
  open,
  mode,
  ownerId,
  group,
  media,
  parentGroupId = null,
  onClose,
}: MediaGroupEditorDialogProps) {
  const titleId = useId();
  const descId = useId();
  const { syncNow } = useConsoleSync();
  const workspace = useWorkspaceOptional();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const mediaGroups = useConsoleDataStore((s) => s.mediaGroups);

  const [name, setName] = useState("");
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_GROUP_COLOR);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && group) {
      setName(group.name);
      setAccentColor(resolveGroupColor(group.accent_color));
      setSelectedMediaIds(new Set(group.member_media_ids));
    } else {
      setName("");
      setAccentColor(DEFAULT_GROUP_COLOR);
      setSelectedMediaIds(new Set());
    }
  }, [open, mode, group]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving && !deleteInProgress) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, saving, deleteInProgress]);

  const toggleMedia = useCallback((mediaId: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  }, []);

  const sortedMedia = useMemo(
    () =>
      [...media].sort((a, b) =>
        (a.original_filename ?? a.storage_path).localeCompare(b.original_filename ?? b.storage_path),
      ),
    [media],
  );

  const parentFolder = useMemo(() => {
    if (!parentGroupId) return null;
    return mediaGroups.find((entry) => entry.id === parentGroupId) ?? null;
  }, [mediaGroups, parentGroupId]);

  async function saveGroup() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Folder name is required.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const { data: created, error } = await supabase
          .from("media_groups")
          .insert(
            scopedContentRow(ownerId, workspace?.activeWorkspaceId, {
              name: trimmed,
              accent_color: accentColor,
              parent_id: parentGroupId ?? null,
            }),
          )
          .select("id")
          .single();
        if (error) {
          toast.error(error.message);
          return;
        }
        const memberIds = [...selectedMediaIds];
        if (memberIds.length > 0) {
          const { error: membersError } = await supabase.from("media_group_members").insert(
            memberIds.map((mediaId) => ({ group_id: created.id, media_id: mediaId })),
          );
          if (membersError) {
            toast.error(membersError.message);
            return;
          }
        }
        toast.success(`Folder “${trimmed}” created`);
        useConsoleDataStore.setState((state) => ({
          mediaGroups: [
            ...state.mediaGroups,
            {
              id: created.id,
              owner_id: ownerId,
              workspace_id: workspace?.activeWorkspaceId ?? null,
              name: trimmed,
              accent_color: accentColor,
              parent_id: parentGroupId,
              created_at: new Date().toISOString(),
              member_media_ids: memberIds,
            },
          ],
        }));
      } else if (group) {
        const { error } = await supabase
          .from("media_groups")
          .update({ name: trimmed, accent_color: accentColor })
          .eq("id", group.id);
        if (error) {
          toast.error(error.message);
          return;
        }

        const previous = new Set(group.member_media_ids);
        const next = selectedMediaIds;
        const toAdd = [...next].filter((id) => !previous.has(id));
        const toRemove = [...previous].filter((id) => !next.has(id));

        if (toRemove.length > 0) {
          const { error: removeError } = await supabase
            .from("media_group_members")
            .delete()
            .eq("group_id", group.id)
            .in("media_id", toRemove);
          if (removeError) {
            toast.error(removeError.message);
            return;
          }
        }
        if (toAdd.length > 0) {
          const { error: addError } = await supabase.from("media_group_members").insert(
            toAdd.map((mediaId) => ({ group_id: group.id, media_id: mediaId })),
          );
          if (addError) {
            toast.error(addError.message);
            return;
          }
        }
        toast.success("Folder updated");
        useConsoleDataStore.setState((state) => ({
          mediaGroups: state.mediaGroups.map((entry) =>
            entry.id === group.id
              ? {
                  ...entry,
                  name: trimmed,
                  accent_color: accentColor,
                  member_media_ids: [...selectedMediaIds],
                }
              : entry,
          ),
        }));
      }
      await syncNow();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save folder");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!group) return;
    setDeleteInProgress(true);
    try {
      const { error } = await supabase.from("media_groups").delete().eq("id", group.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Folder “${group.name}” removed`);
      useConsoleDataStore.setState((state) => ({
        mediaGroups: state.mediaGroups.filter((entry) => entry.id !== group.id),
      }));
      await syncNow();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete folder");
    } finally {
      setDeleteInProgress(false);
    }
  }

  if (!open) return null;

  const dialogTitle = mode === "create" ? "Create library folder" : `Edit “${group?.name ?? "folder"}”`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Dismiss"
        onClick={() => !saving && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="device-group-editor-panel relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border shadow-2xl"
        style={{ "--group-accent": accentColor } as React.CSSProperties}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/80 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
              {dialogTitle}
            </h2>
            <p id={descId} className="mt-1 text-sm text-muted-foreground">
              {mode === "create"
                ? parentFolder
                  ? `Creates a subfolder inside “${parentFolder.name}”.`
                  : "Name your folder and pick which files belong to it."
                : "Rename, recolor, or adjust file membership."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="media-folder-name">Folder name</Label>
            <Input
              id="media-folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Brand assets"
              disabled={saving}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label>Accent color</Label>
            <div className="flex flex-wrap gap-2">
              {DEVICE_GROUP_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  disabled={saving}
                  aria-label={color.label}
                  aria-pressed={accentColor === color.hex}
                  data-selected={accentColor === color.hex}
                  className="device-group-color-swatch"
                  style={{ "--swatch": color.hex, background: color.hex } as React.CSSProperties}
                  onClick={() => setAccentColor(color.hex)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Files in folder</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {selectedMediaIds.size} of {media.length} selected
              </span>
            </div>
            {media.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No files yet. Upload some first, then assign them here.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-2">
                {sortedMedia.map((item) => {
                  const selected = selectedMediaIds.has(item.id);
                  const label = item.original_filename ?? item.storage_path;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => toggleMedia(item.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          selected ? "bg-brand-soft/80 ring-1 ring-brand/25" : "hover:bg-muted/70",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            selected
                              ? "border-brand bg-brand text-brand-contrast"
                              : "border-border bg-background",
                          )}
                        >
                          {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </span>
                        <MediaFolderFileThumb item={item} />
                        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border/80 bg-muted/20 px-6 py-4">
          {mode === "edit" && group ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={saving || deleteInProgress}
              onClick={() => void deleteGroup()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteInProgress ? "Deleting…" : "Delete folder"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveGroup()} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : mode === "create" ? "Create folder" : "Save changes"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
