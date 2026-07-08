"use client";

import type { Device, DeviceStatus } from "@signage/types";
import { DeviceFiltersPopover } from "@/components/devices/device-filters-popover";
import {
  applyDeviceFilters,
  applyDeviceSearchFilter,
  collectDeviceTags,
  DEFAULT_DEVICE_FILTERS,
  DEVICE_SORT_OPTIONS,
  sortDeviceList,
  type DeviceFiltersState,
  type DeviceSort,
} from "@/lib/device-display";
import { ArrowLeft, FolderOutput, Monitor, Plus, Settings, Trash2, Tv } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import {
  deviceDetailPath,
  groupDetailPath,
  groupsListPath,
  useAdminClientRoutes,
} from "@/components/admin/admin-client-route-context";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { CONSOLE_PANEL_CHROME } from "@/components/console/console-panel";
import { ListPageHeader } from "@/components/console/list-page-header";
import { ViewModeToggle } from "@/components/console/view-mode-toggle";
import { DeviceGroupEditorDialog } from "@/components/device-groups/device-group-editor-dialog";
import { DeviceScreenCard } from "@/components/devices/device-screen-card";
import { LinkScreenDialog } from "@/components/devices/link-screen-dialog";
import { MoveToWorkspaceDialog } from "@/components/workspace/move-to-workspace-dialog";
import { useWorkspaceOptional } from "@/components/workspace/workspace-provider";
import {
  GatedHeaderButton,
  PermissionTooltip,
  permissionHint,
  useWorkspacePermission,
} from "@/components/workspace/permission-guard";
import { Button } from "@/components/ui/button";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import {
  findGroupContainingDevice,
  moveDevicesIntoGroup,
  patchStoreAfterDevicesMovedToGroup,
  restoreIndividualPlaylistsForDevices,
} from "@/lib/group-playlist";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import { effectiveDeviceStatus, formatDeviceLastSeen } from "@/lib/device-status";
import { groupFilterLabel, parseGroupFilterFromSearchParam } from "@/lib/device-group-navigation";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { DeviceDisabledBadge, deviceDisabledPresentation } from "@/components/device-disabled-notice";
import { DevicePlaybackPowerButton } from "@/components/device-playback-toggle";
import { useActiveAppRelease, type ActiveAppRelease } from "@/hooks/use-active-app-release";
import { DeviceAddToFolderButton } from "@/components/devices/device-add-to-folder-button";
import { DevicePlatformBadge } from "@/components/devices/device-platform-badge";
import { ItemActionMenu } from "@/components/console/item-action-menu";

function statusLabel(status: DeviceStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "pending_pairing":
      return "Pending";
    default:
      return status;
  }
}

function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
        status === "online" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
        status === "offline" && "bg-muted text-muted-foreground",
        status === "pending_pairing" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function DevicesManager() {
  useStaleOnlineTick();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const devices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];
  const deviceGroups = useConsoleDataStore((s) => s.deviceGroups) as DeviceGroupWithMembers[];
  const ownerId = useConsoleOwnerId();
  const activeAppRelease = useActiveAppRelease();

  const { syncNow } = useConsoleSync();
  const adminStaff = useOptionalAdminStaff();
  const adminRoutes = useAdminClientRoutes();
  const searchParams = useSearchParams();
  const plan = usePlanQuota();
  const deviceLimit = plan?.deviceLimit ?? null;
  const accountDisabled = plan?.accountDisabled ?? false;
  const readOnly = adminStaff != null && !adminStaff.canWrite;
  const canControlPlayback = Boolean(adminStaff?.canWrite && !accountDisabled);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deviceSort, setDeviceSort] = useState<DeviceSort>("created-desc");
  const [deviceFilters, setDeviceFilters] = useState<DeviceFiltersState>(DEFAULT_DEVICE_FILTERS);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [devicePendingDelete, setDevicePendingDelete] = useState<Device | null>(null);
  const [devicePendingMove, setDevicePendingMove] = useState<Device | null>(null);
  const workspace = useWorkspaceOptional();
  const canManageScreens = useWorkspacePermission("manage_screens");
  const screensHint = permissionHint("manage_screens");
  const canMoveBetweenWorkspaces = (workspace?.workspaces.length ?? 0) > 1;
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupBeingEdited, setGroupBeingEdited] = useState<DeviceGroupWithMembers | null>(null);
  const [pendingMoveToGroup, setPendingMoveToGroup] = useState<{
    device: Device;
    targetGroup: DeviceGroupWithMembers;
    sourceGroup: DeviceGroupWithMembers;
  } | null>(null);
  const [moveInProgress, setMoveInProgress] = useState(false);

  const groupFilter = useMemo(
    () => parseGroupFilterFromSearchParam(searchParams.get("group"), deviceGroups),
    [searchParams, deviceGroups],
  );

  const activeGroup = useMemo(
    () =>
      groupFilter !== "all" && groupFilter !== "ungrouped"
        ? deviceGroups.find((group) => group.id === groupFilter) ?? null
        : null,
    [deviceGroups, groupFilter],
  );

  const isGroupView = activeGroup != null;

  const refreshAfterMutation = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  const confirmDeleteDevice = useCallback(async () => {
    if (!devicePendingDelete) return;
    setDeleteInProgress(true);
    try {
      const { error } = await supabase.from("devices").delete().eq("id", devicePendingDelete.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Device removed");
      setDevicePendingDelete(null);
      await refreshAfterMutation();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove device";
      toast.error(message);
    } finally {
      setDeleteInProgress(false);
    }
  }, [devicePendingDelete, refreshAfterMutation, supabase]);

  const deviceGroupsByDeviceId = useMemo(() => {
    const map = new Map<string, DeviceGroupWithMembers[]>();
    for (const group of deviceGroups) {
      for (const deviceId of group.member_device_ids) {
        const list = map.get(deviceId) ?? [];
        list.push(group);
        map.set(deviceId, list);
      }
    }
    return map;
  }, [deviceGroups]);

  const groupedDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of deviceGroups) {
      for (const deviceId of group.member_device_ids) {
        ids.add(deviceId);
      }
    }
    return ids;
  }, [deviceGroups]);

  const knownTags = useMemo(() => collectDeviceTags(devices), [devices]);

  const filtered = useMemo(() => {
    let list = devices;
    if (groupFilter === "ungrouped") {
      list = list.filter((device) => !groupedDeviceIds.has(device.id));
    } else if (activeGroup) {
      const memberIds = new Set(activeGroup.member_device_ids);
      list = list.filter((device) => memberIds.has(device.id));
    }
    list = applyDeviceFilters(list, deviceFilters);
    list = applyDeviceSearchFilter(list, search);
    return sortDeviceList(list, deviceSort);
  }, [devices, deviceFilters, deviceSort, search, groupFilter, groupedDeviceIds, activeGroup]);

  const openEditGroup = useCallback((group: DeviceGroupWithMembers) => {
    setGroupBeingEdited(group);
    setGroupEditorOpen(true);
  }, []);

  const removeDeviceFromFolder = useCallback(
    async (device: Device) => {
      if (!activeGroup || readOnly || !ownerId) return;
      try {
        const { error } = await supabase
          .from("device_group_members")
          .delete()
          .eq("group_id", activeGroup.id)
          .eq("device_id", device.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        const { error: restoreError } = await restoreIndividualPlaylistsForDevices(supabase, ownerId, [
          device as DeviceWithAssignments,
        ], activeGroup.playlist_id);
        if (restoreError) {
          toast.error(restoreError);
          return;
        }
        toast.success(`“${device.name}” removed from group`);
        useConsoleDataStore.setState((state) => ({
          deviceGroups: state.deviceGroups.map((entry) =>
            entry.id === activeGroup.id
              ? {
                  ...entry,
                  member_device_ids: entry.member_device_ids.filter((id) => id !== device.id),
                }
              : entry,
          ),
        }));
        await refreshAfterMutation();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to remove screen from group";
        toast.error(message);
      }
    },
    [activeGroup, ownerId, readOnly, refreshAfterMutation, supabase],
  );

  const performMoveToGroup = useCallback(
    async (device: Device, group: DeviceGroupWithMembers, sourceGroup: DeviceGroupWithMembers | null) => {
      if (!ownerId) return;
      setMoveInProgress(true);
      try {
        const { playlistId, error: moveError } = await moveDevicesIntoGroup(supabase, ownerId, group, [device.id]);
        if (moveError) {
          toast.error(moveError);
          return;
        }

        patchStoreAfterDevicesMovedToGroup(group.id, [device.id], playlistId);

        if (sourceGroup) {
          toast.success(`“${device.name}” moved from “${sourceGroup.name}” to “${group.name}”`);
        } else {
          toast.success(`“${device.name}” added to “${group.name}”`);
        }
        await refreshAfterMutation();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to add screen to group";
        toast.error(message);
      } finally {
        setMoveInProgress(false);
        setPendingMoveToGroup(null);
      }
    },
    [ownerId, refreshAfterMutation, supabase],
  );

  const addDeviceToFolder = useCallback(
    async (device: Device, group: DeviceGroupWithMembers) => {
      if (readOnly || !ownerId) return;
      if (group.member_device_ids.includes(device.id)) {
        toast.error(`“${device.name}” is already in “${group.name}”`);
        return;
      }

      const previousGroup = findGroupContainingDevice(deviceGroups, device.id, group.id);
      if (previousGroup) {
        setPendingMoveToGroup({ device, targetGroup: group, sourceGroup: previousGroup });
        return;
      }

      await performMoveToGroup(device, group, null);
    },
    [deviceGroups, ownerId, performMoveToGroup, readOnly],
  );

  const pageTitle = isGroupView ? groupFilterLabel(groupFilter, activeGroup) : "Screens";

  return (
    <>
      <div className={cn("flex min-h-[min(70vh,720px)] flex-col", CONSOLE_PANEL_CHROME)}>
        <ListPageHeader
          title={pageTitle}
          backButton={
            isGroupView ? (
              <Link
                href={groupsListPath(adminRoutes)}
                aria-label="Back to groups"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2.25} />
              </Link>
            ) : undefined
          }
          primaryAction={
            !readOnly ? (
              <GatedHeaderButton
                permission="manage_screens"
                type="button"
                onClick={() => setLinkDialogOpen(true)}
                label="Link screen"
                icon={<Plus className="h-4 w-4" aria-hidden />}
              />
            ) : undefined
          }
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search screens…"
          sortOptions={DEVICE_SORT_OPTIONS}
          activeSortId={deviceSort}
          onSortChange={(id) => setDeviceSort(id as DeviceSort)}
          filtersContent={
            <DeviceFiltersPopover
              value={deviceFilters}
              onApply={setDeviceFilters}
              knownTags={knownTags}
            />
          }
          trailing={
            <div className="flex shrink-0 items-center gap-2">
              {isGroupView && activeGroup ? (
                <Link
                  href={groupDetailPath(activeGroup.id, adminRoutes)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Tv className="h-3.5 w-3.5" aria-hidden />
                  Group playlist
                </Link>
              ) : null}
              {isGroupView && activeGroup && !readOnly ? (
                canManageScreens ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={() => openEditGroup(activeGroup)}
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden />
                    Manage group
                  </Button>
                ) : (
                  <PermissionTooltip reason={screensHint}>
                    <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" disabled>
                      <Settings className="h-3.5 w-3.5" aria-hidden />
                      Manage group
                    </Button>
                  </PermissionTooltip>
                )
              ) : null}
              <ViewModeToggle view={view} onViewChange={setView} />
            </div>
          }
        />

        <div className="flex-1 p-4 sm:p-5">
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Monitor className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground">No screens linked yet</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Open the TV app, note the pairing code, then use Link screen to connect a display.
              </p>
              {!readOnly ? (
                canManageScreens ? (
                  <Button type="button" className="mt-4 gap-2" onClick={() => setLinkDialogOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Link screen
                  </Button>
                ) : (
                  <PermissionTooltip reason={screensHint}>
                    <Button type="button" className="mt-4 gap-2" disabled>
                      <Plus className="h-4 w-4" aria-hidden />
                      Link screen
                    </Button>
                  </PermissionTooltip>
                )
              ) : null}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
              <p className="text-sm font-medium text-foreground">No screens match</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">Try another search or filter.</p>
            </div>
          ) : view === "grid" ? (
            <ul className="device-screen-grid grid grid-cols-2 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((device) => (
                <DeviceScreenCard
                  key={device.id}
                  device={device}
                  groups={deviceGroupsByDeviceId.get(device.id) ?? []}
                  returnGroupId={isGroupView ? groupFilter : null}
                  activeAppRelease={activeAppRelease}
                  accountDisabled={accountDisabled}
                  canControlPlayback={canControlPlayback}
                  canDelete={!readOnly && canManageScreens}
                  onRequestDelete={() => setDevicePendingDelete(device)}
                  onMoveToWorkspace={
                    canMoveBetweenWorkspaces && !readOnly && canManageScreens
                      ? () => setDevicePendingMove(device)
                      : undefined
                  }
                  onRemoveFromFolder={
                    isGroupView && !readOnly && canManageScreens ? () => void removeDeviceFromFolder(device) : undefined
                  }
                  folderName={activeGroup?.name}
                  folders={!isGroupView && !readOnly && canManageScreens ? deviceGroups : []}
                  onAddToFolder={
                    !isGroupView && !readOnly && canManageScreens
                      ? (groupId) => {
                          const group = deviceGroups.find((entry) => entry.id === groupId);
                          if (group) void addDeviceToFolder(device, group);
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {filtered.map((device) => (
                <DeviceListRow
                  key={device.id}
                  device={device}
                  groups={deviceGroupsByDeviceId.get(device.id) ?? []}
                  returnGroupId={isGroupView ? groupFilter : null}
                  activeAppRelease={activeAppRelease}
                  accountDisabled={accountDisabled}
                  canControlPlayback={canControlPlayback}
                  canDelete={!readOnly && canManageScreens}
                  onRequestDelete={() => setDevicePendingDelete(device)}
                  onRemoveFromFolder={
                    isGroupView && !readOnly && canManageScreens ? () => void removeDeviceFromFolder(device) : undefined
                  }
                  folderName={activeGroup?.name}
                  folders={!isGroupView && !readOnly && canManageScreens ? deviceGroups : []}
                  onAddToFolder={
                    !isGroupView && !readOnly && canManageScreens
                      ? (groupId) => {
                          const group = deviceGroups.find((entry) => entry.id === groupId);
                          if (group) void addDeviceToFolder(device, group);
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <LinkScreenDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        deviceCount={devices.length}
        deviceLimit={deviceLimit}
        onLinked={refreshAfterMutation}
      />

      <ConfirmDeleteDialog
        open={devicePendingDelete !== null}
        title={devicePendingDelete ? `Remove “${devicePendingDelete.name}”?` : "Remove screen?"}
        description="This disconnects the screen from your account. The TV will need to be paired again to show your content."
        confirmLabel="Remove screen"
        onClose={() => !deleteInProgress && setDevicePendingDelete(null)}
        onConfirm={confirmDeleteDevice}
        isConfirming={deleteInProgress}
      />

      {workspace ? (
        <MoveToWorkspaceDialog
          open={devicePendingMove !== null}
          onClose={() => setDevicePendingMove(null)}
          entityType="device"
          entityId={devicePendingMove?.id ?? ""}
          entityLabel={devicePendingMove?.name ?? "screen"}
        />
      ) : null}

      <ConfirmActionDialog
        open={pendingMoveToGroup != null}
        title="Move screen to another group?"
        description={
          pendingMoveToGroup ? (
            <>
              <strong className="font-medium text-foreground">{pendingMoveToGroup.device.name}</strong> is currently
              in <strong className="font-medium text-foreground">{pendingMoveToGroup.sourceGroup.name}</strong>. Adding
              it to <strong className="font-medium text-foreground">{pendingMoveToGroup.targetGroup.name}</strong> will
              remove it from the current group and switch it to the new group&apos;s playlist.
            </>
          ) : null
        }
        confirmLabel="Move screen"
        onClose={() => !moveInProgress && setPendingMoveToGroup(null)}
        onConfirm={() => {
          if (!pendingMoveToGroup) return;
          void performMoveToGroup(
            pendingMoveToGroup.device,
            pendingMoveToGroup.targetGroup,
            pendingMoveToGroup.sourceGroup,
          );
        }}
        isConfirming={moveInProgress}
      />

      {ownerId && groupBeingEdited ? (
        <DeviceGroupEditorDialog
          open={groupEditorOpen}
          mode="edit"
          ownerId={ownerId}
          group={groupBeingEdited}
          devices={devices}
          onClose={() => {
            setGroupEditorOpen(false);
            setGroupBeingEdited(null);
            void syncNow();
          }}
        />
      ) : null}
    </>
  );
}

function DeviceListRow({
  device,
  groups,
  returnGroupId = null,
  activeAppRelease,
  accountDisabled = false,
  canControlPlayback = false,
  canDelete = true,
  onRequestDelete,
  onRemoveFromFolder,
  folderName,
  folders = [],
  onAddToFolder,
}: {
  device: DeviceWithAssignments;
  groups: DeviceGroupWithMembers[];
  returnGroupId?: string | null;
  activeAppRelease: ActiveAppRelease | null;
  accountDisabled?: boolean;
  canControlPlayback?: boolean;
  canDelete?: boolean;
  onRequestDelete: () => void;
  onRemoveFromFolder?: () => void;
  folderName?: string;
  folders?: DeviceGroupWithMembers[];
  onAddToFolder?: (groupId: string) => void;
}) {
  const adminRoutes = useAdminClientRoutes();
  const disabledState = deviceDisabledPresentation(device, accountDisabled);
  const detailHref = deviceDetailPath(device.public_code, adminRoutes, returnGroupId);
  const status = effectiveDeviceStatus(device);

  return (
    <li className="relative flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
      <Link
        href={detailHref}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Open screen: ${device.name}`}
      />

      <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-3 pointer-events-none sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border sm:h-11 sm:w-11">
          <Tv className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{device.name}</p>
            <DevicePlatformBadge platform={device.platform} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDeviceLastSeen(device.last_seen)}
            {groups.length > 0 ? ` · ${groups.map((group) => group.name).join(", ")}` : ""}
          </p>
        </div>
        <StatusBadge status={status} />
        {disabledState.show ? (
          <DeviceDisabledBadge
            accountSuspended={disabledState.accountSuspended}
            pausedByQuota={disabledState.pausedByQuota}
          />
        ) : null}
      </div>

      <div className="relative z-[2] flex shrink-0 items-center gap-1">
        {onAddToFolder ? (
          <DeviceAddToFolderButton
            deviceName={device.name}
            folders={folders}
            onAddToFolder={onAddToFolder}
            layout="list"
          />
        ) : null}
        <ItemActionMenu
          ariaLabel={`Actions for ${device.name}`}
          items={[
            {
              label: "Open settings",
              href: detailHref,
              icon: <Settings className="h-3.5 w-3.5" aria-hidden />,
            },
            ...(onRemoveFromFolder
              ? [
                  {
                    label: folderName ? `Remove from ${folderName}` : "Remove from group",
                    onClick: onRemoveFromFolder,
                    icon: <FolderOutput className="h-3.5 w-3.5" aria-hidden />,
                  },
                ]
              : []),
            ...(canDelete
              ? [
                  {
                    label: "Remove screen",
                    onClick: onRequestDelete,
                    destructive: true,
                    icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
                  },
                ]
              : []),
          ]}
        />
        {canControlPlayback ? (
          <DevicePlaybackPowerButton
            device={device}
            variant="outline"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          />
        ) : null}
      </div>
    </li>
  );
}
