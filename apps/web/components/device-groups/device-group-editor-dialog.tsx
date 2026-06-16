"use client";

import type { Device } from "@signage/types";
import { Check, Monitor, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import { DEFAULT_GROUP_COLOR, DEVICE_GROUP_COLORS, resolveGroupColor } from "@/lib/device-group-colors";
import {
  findGroupContainingDevice,
  moveDevicesIntoGroup,
  patchStoreAfterDevicesMovedToGroup,
  restoreIndividualPlaylistsForDevices,
} from "@/lib/group-playlist";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { useConsoleDataStore } from "@/stores/console-data-store";

type DeviceGroupEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  ownerId: string;
  group: DeviceGroupWithMembers | null;
  devices: Device[];
  onClose: () => void;
};

export function DeviceGroupEditorDialog({
  open,
  mode,
  ownerId,
  group,
  devices,
  onClose,
}: DeviceGroupEditorDialogProps) {
  const titleId = useId();
  const descId = useId();
  const { syncNow } = useConsoleSync();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const deviceGroups = useConsoleDataStore((s) => s.deviceGroups) as DeviceGroupWithMembers[];

  const [name, setName] = useState("");
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_GROUP_COLOR);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    deviceId: string;
    deviceName: string;
    fromGroupName: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && group) {
      setName(group.name);
      setAccentColor(resolveGroupColor(group.accent_color));
      setSelectedDeviceIds(new Set(group.member_device_ids));
    } else {
      setName("");
      setAccentColor(DEFAULT_GROUP_COLOR);
      setSelectedDeviceIds(new Set());
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

  const toggleDevice = useCallback(
    (deviceId: string) => {
      if (selectedDeviceIds.has(deviceId)) {
        setSelectedDeviceIds((prev) => {
          const next = new Set(prev);
          next.delete(deviceId);
          return next;
        });
        return;
      }

      const otherGroup = findGroupContainingDevice(deviceGroups, deviceId, group?.id ?? null);
      if (otherGroup) {
        const device = devices.find((entry) => entry.id === deviceId);
        setPendingMove({
          deviceId,
          deviceName: device?.name ?? "This screen",
          fromGroupName: otherGroup.name,
        });
        return;
      }

      setSelectedDeviceIds((prev) => new Set(prev).add(deviceId));
    },
    [deviceGroups, devices, group?.id, selectedDeviceIds],
  );

  const confirmPendingMove = useCallback(() => {
    if (!pendingMove) return;
    setSelectedDeviceIds((prev) => new Set(prev).add(pendingMove.deviceId));
    setPendingMove(null);
  }, [pendingMove]);

  const sortedDevices = useMemo(
    () => [...devices].sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  async function saveGroup() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Group name is required.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const { data: created, error } = await supabase
          .from("device_groups")
          .insert({ owner_id: ownerId, name: trimmed, accent_color: accentColor })
          .select("id")
          .single();
        if (error) {
          toast.error(error.message);
          return;
        }
        const memberIds = [...selectedDeviceIds];
        const createdGroup: DeviceGroupWithMembers = {
          id: created.id,
          owner_id: ownerId,
          name: trimmed,
          accent_color: accentColor,
          playlist_id: null,
          created_at: new Date().toISOString(),
          member_device_ids: [],
        };
        let playlistId: string | null = null;
        if (memberIds.length > 0) {
          const { playlistId: ensured, error: moveError } = await moveDevicesIntoGroup(
            supabase,
            ownerId,
            createdGroup,
            memberIds,
          );
          if (moveError) {
            toast.error(moveError);
            return;
          }
          playlistId = ensured;
        }
        toast.success(`Group “${trimmed}” created`);
        useConsoleDataStore.setState((state) => ({
          deviceGroups: [
            ...state.deviceGroups.map((entry) => ({
              ...entry,
              member_device_ids: entry.member_device_ids.filter((id) => !memberIds.includes(id)),
            })),
            { ...createdGroup, member_device_ids: memberIds, playlist_id: playlistId },
          ],
        }));
      } else if (group) {
        const { error } = await supabase
          .from("device_groups")
          .update({ name: trimmed, accent_color: accentColor })
          .eq("id", group.id);
        if (error) {
          toast.error(error.message);
          return;
        }

        const previous = new Set(group.member_device_ids);
        const next = selectedDeviceIds;
        const toAdd = [...next].filter((id) => !previous.has(id));
        const toRemove = [...previous].filter((id) => !next.has(id));
        let playlistId = group.playlist_id;

        if (toRemove.length > 0) {
          const { error: removeError } = await supabase
            .from("device_group_members")
            .delete()
            .eq("group_id", group.id)
            .in("device_id", toRemove);
          if (removeError) {
            toast.error(removeError.message);
            return;
          }
          const removedDevices = (devices as DeviceWithAssignments[]).filter((device) =>
            toRemove.includes(device.id),
          );
          const { error: restoreError } = await restoreIndividualPlaylistsForDevices(
            supabase,
            ownerId,
            removedDevices,
            group.playlist_id,
          );
          if (restoreError) {
            toast.error(restoreError);
            return;
          }
        }
        if (toAdd.length > 0) {
          const groupForMove: DeviceGroupWithMembers = {
            ...group,
            name: trimmed,
            accent_color: accentColor,
            member_device_ids: group.member_device_ids.filter((id) => !toRemove.includes(id)),
          };
          const { playlistId: ensured, error: moveError } = await moveDevicesIntoGroup(
            supabase,
            ownerId,
            groupForMove,
            toAdd,
          );
          if (moveError) {
            toast.error(moveError);
            return;
          }
          playlistId = ensured;
          patchStoreAfterDevicesMovedToGroup(group.id, toAdd, playlistId);
        }

        toast.success("Group updated");
        useConsoleDataStore.setState((state) => ({
          deviceGroups: state.deviceGroups.map((entry) =>
            entry.id === group.id
              ? {
                  ...entry,
                  name: trimmed,
                  accent_color: accentColor,
                  playlist_id: playlistId,
                  member_device_ids: [...selectedDeviceIds],
                }
              : entry,
          ),
        }));
      }
      await syncNow();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save group");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!group) return;
    setDeleteInProgress(true);
    try {
      const { error } = await supabase.from("device_groups").delete().eq("id", group.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Group “${group.name}” removed`);
      useConsoleDataStore.setState((state) => ({
        deviceGroups: state.deviceGroups.filter((entry) => entry.id !== group.id),
      }));
      await syncNow();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete group");
    } finally {
      setDeleteInProgress(false);
    }
  }

  if (!open) return null;

  const dialogTitle = mode === "create" ? "Create group" : `Manage “${group?.name ?? "group"}”`;

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
                  ? "Name your group and choose screens to assign. Each screen can only belong to one group at a time."
                  : "Rename, recolor, or change assigned screens. Assigning a screen here moves it out of any other group."}
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
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lobby displays"
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
                <Label>Screens in group</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {selectedDeviceIds.size} of {devices.length} selected
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Screens already in another group will move here when selected. Unchecked screens return to Ungrouped.
              </p>
              {devices.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No screens linked yet. Pair a TV first, then assign it here.
                </p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-2">
                  {sortedDevices.map((device) => {
                    const selected = selectedDeviceIds.has(device.id);
                    const otherGroup = findGroupContainingDevice(deviceGroups, device.id, group?.id ?? null);
                    return (
                      <li key={device.id}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => toggleDevice(device.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                            selected
                              ? "bg-brand-soft/80 ring-1 ring-brand/25"
                              : "hover:bg-muted/70",
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
                          <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{device.name}</span>
                            {otherGroup && !selected ? (
                              <span className="block truncate text-xs text-amber-700 dark:text-amber-300">
                                In {otherGroup.name}
                              </span>
                            ) : null}
                          </span>
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
                {deleteInProgress ? "Deleting…" : "Delete group"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveGroup()} disabled={saving || !name.trim()}>
                {saving ? "Saving…" : mode === "create" ? "Create group" : "Save changes"}
              </Button>
            </div>
          </footer>
        </div>

      <ConfirmActionDialog
        open={pendingMove != null}
        title="Move screen to this group?"
        description={
          pendingMove ? (
            <>
              <strong className="font-medium text-foreground">{pendingMove.deviceName}</strong> is currently in{" "}
              <strong className="font-medium text-foreground">{pendingMove.fromGroupName}</strong>. Moving it here
              will remove it from that group and switch it to this group&apos;s playlist.
            </>
          ) : null
        }
        confirmLabel="Move screen"
        onClose={() => setPendingMove(null)}
        onConfirm={confirmPendingMove}
      />
    </div>
  );
}
