"use client";

import type { Playlist } from "@signage/types";
import { Check, ListVideo, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlaylistGroupWithMembers } from "@/lib/console-sync";
import { DEFAULT_GROUP_COLOR, DEVICE_GROUP_COLORS, resolveGroupColor } from "@/lib/device-group-colors";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useWorkspaceOptional } from "@/components/workspace/workspace-provider";
import { scopedContentRow } from "@/lib/workspace/content-scope";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { useConsoleDataStore } from "@/stores/console-data-store";
import "@/components/device-groups/device-groups.css";

type PlaylistGroupEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  ownerId: string;
  group: PlaylistGroupWithMembers | null;
  playlists: Playlist[];
  onClose: () => void;
};

export function PlaylistGroupEditorDialog({
  open,
  mode,
  ownerId,
  group,
  playlists,
  onClose,
}: PlaylistGroupEditorDialogProps) {
  const titleId = useId();
  const descId = useId();
  const { syncNow } = useConsoleSync();
  const workspace = useWorkspaceOptional();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [name, setName] = useState("");
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_GROUP_COLOR);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && group) {
      setName(group.name);
      setAccentColor(resolveGroupColor(group.accent_color));
      setSelectedPlaylistIds(new Set(group.member_playlist_ids));
    } else {
      setName("");
      setAccentColor(DEFAULT_GROUP_COLOR);
      setSelectedPlaylistIds(new Set());
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

  const togglePlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistIds((prev) => {
      const next = new Set(prev);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
  }, []);

  const sortedPlaylists = useMemo(
    () => [...playlists].sort((a, b) => a.name.localeCompare(b.name)),
    [playlists],
  );

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
          .from("playlist_groups")
          .insert(scopedContentRow(ownerId, workspace?.activeWorkspaceId, { name: trimmed, accent_color: accentColor }))
          .select("id")
          .single();
        if (error) {
          toast.error(error.message);
          return;
        }
        const memberIds = [...selectedPlaylistIds];
        if (memberIds.length > 0) {
          const { error: membersError } = await supabase.from("playlist_group_members").insert(
            memberIds.map((playlistId) => ({ group_id: created.id, playlist_id: playlistId })),
          );
          if (membersError) {
            toast.error(membersError.message);
            return;
          }
        }
        toast.success(`Folder “${trimmed}” created`);
        useConsoleDataStore.setState((state) => ({
          playlistGroups: [
            ...state.playlistGroups,
            {
              id: created.id,
              owner_id: ownerId,
              workspace_id: workspace?.activeWorkspaceId ?? null,
              name: trimmed,
              accent_color: accentColor,
              created_at: new Date().toISOString(),
              member_playlist_ids: memberIds,
            },
          ],
        }));
      } else if (group) {
        const { error } = await supabase
          .from("playlist_groups")
          .update({ name: trimmed, accent_color: accentColor })
          .eq("id", group.id);
        if (error) {
          toast.error(error.message);
          return;
        }

        const previous = new Set(group.member_playlist_ids);
        const next = selectedPlaylistIds;
        const toAdd = [...next].filter((id) => !previous.has(id));
        const toRemove = [...previous].filter((id) => !next.has(id));

        if (toRemove.length > 0) {
          const { error: removeError } = await supabase
            .from("playlist_group_members")
            .delete()
            .eq("group_id", group.id)
            .in("playlist_id", toRemove);
          if (removeError) {
            toast.error(removeError.message);
            return;
          }
        }
        if (toAdd.length > 0) {
          const { error: addError } = await supabase.from("playlist_group_members").insert(
            toAdd.map((playlistId) => ({ group_id: group.id, playlist_id: playlistId })),
          );
          if (addError) {
            toast.error(addError.message);
            return;
          }
        }
        toast.success("Folder updated");
        useConsoleDataStore.setState((state) => ({
          playlistGroups: state.playlistGroups.map((entry) =>
            entry.id === group.id
              ? {
                  ...entry,
                  name: trimmed,
                  accent_color: accentColor,
                  member_playlist_ids: [...selectedPlaylistIds],
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
      const { error } = await supabase.from("playlist_groups").delete().eq("id", group.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Folder “${group.name}” removed`);
      useConsoleDataStore.setState((state) => ({
        playlistGroups: state.playlistGroups.filter((entry) => entry.id !== group.id),
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

  const dialogTitle = mode === "create" ? "Create playlist folder" : `Edit “${group?.name ?? "folder"}”`;

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
                  ? "Name your folder and pick which playlists belong to it."
                  : "Rename, recolor, or adjust playlist membership."}
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
              <Label htmlFor="playlist-folder-name">Folder name</Label>
              <Input
                id="playlist-folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer promos"
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
                <Label>Playlists in folder</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {selectedPlaylistIds.size} of {playlists.length} selected
                </span>
              </div>
              {playlists.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No playlists yet. Create one first, then assign it here.
                </p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-2">
                  {sortedPlaylists.map((playlist) => {
                    const selected = selectedPlaylistIds.has(playlist.id);
                    return (
                      <li key={playlist.id}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => togglePlaylist(playlist.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
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
                          <ListVideo className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1 truncate font-medium">{playlist.name}</span>
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
