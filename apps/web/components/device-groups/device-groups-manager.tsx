"use client";

import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAppRouter } from "@/hooks/use-app-router";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { devicesListPath, groupDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { HeaderPrimaryButton } from "@/components/console/header-primary-button";
import { ListPageHeader } from "@/components/console/list-page-header";
import { CONSOLE_PANEL_CHROME } from "@/components/console/console-panel";
import { ViewModeToggle } from "@/components/console/view-mode-toggle";
import { DeviceGroupEditorDialog } from "@/components/device-groups/device-group-editor-dialog";
import {
  DeviceGroupWallCardFromGroup,
  DeviceGroupWallListRowFromGroup,
  GroupWallCreateCard,
  GroupWallCreateListRow,
} from "@/components/device-groups/device-group-wall-card";
import { Button } from "@/components/ui/button";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import { effectiveDeviceStatus } from "@/lib/device-status";
import { cn } from "@/lib/utils";
import { useConsoleDataStore } from "@/stores/console-data-store";
import "@/components/device-groups/device-groups.css";

export function DeviceGroupsManager() {
  const router = useAppRouter();
  const adminRoutes = useAdminClientRoutes();
  const adminStaff = useOptionalAdminStaff();
  const readOnly = adminStaff != null && !adminStaff.canWrite;
  const { syncNow } = useConsoleSync();
  const devices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];
  const deviceGroups = useConsoleDataStore((s) => s.deviceGroups) as DeviceGroupWithMembers[];
  const ownerId = useConsoleDataStore((s) => s.ownerId);

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "edit">("create");
  const [groupBeingEdited, setGroupBeingEdited] = useState<DeviceGroupWithMembers | null>(null);

  const openCreateGroup = useCallback(() => {
    setGroupEditorMode("create");
    setGroupBeingEdited(null);
    setGroupEditorOpen(true);
  }, []);

  const openEditGroup = useCallback((group: DeviceGroupWithMembers) => {
    setGroupEditorMode("edit");
    setGroupBeingEdited(group);
    setGroupEditorOpen(true);
  }, []);

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deviceGroups
      .map((group) => {
        const memberDevices = group.member_device_ids
          .map((id) => devices.find((device) => device.id === id))
          .filter((device): device is DeviceWithAssignments => device != null);
        const onlineCount = memberDevices.filter((device) => effectiveDeviceStatus(device) === "online").length;
        return { group, deviceCount: memberDevices.length, onlineCount };
      })
      .filter((entry) => !q || entry.group.name.toLowerCase().includes(q));
  }, [deviceGroups, devices, search]);

  return (
    <div className={cn("flex min-h-[min(70vh,720px)] flex-col", CONSOLE_PANEL_CHROME)}>
      <ListPageHeader
        title="Screen groups"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search groups…"
        primaryAction={
          !readOnly ? (
            <HeaderPrimaryButton
              type="button"
              onClick={openCreateGroup}
              label="Add group"
              icon={<Plus className="h-4 w-4" aria-hidden />}
            />
          ) : undefined
        }
        trailing={<ViewModeToggle view={view} onViewChange={setView} />}
      />

      <div className="flex-1 p-4 sm:p-5">
        {deviceGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No groups yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Create a group to organize screens by location, department, or campaign.
            </p>
            {!readOnly ? (
              <Button type="button" className="mt-4 gap-2" onClick={openCreateGroup}>
                <Plus className="h-4 w-4" aria-hidden />
                Add group
              </Button>
            ) : null}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No groups match</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">Try another search term.</p>
          </div>
        ) : view === "grid" ? (
          <ul className="device-group-wall-grid grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {entries.map(({ group, deviceCount, onlineCount }) => (
              <DeviceGroupWallCardFromGroup
                key={group.id}
                group={group}
                itemCount={deviceCount}
                onlineCount={onlineCount}
                onOpen={() => router.push(groupDetailPath(group.id, adminRoutes))}
                onEdit={readOnly ? undefined : () => openEditGroup(group)}
              />
            ))}
            {!readOnly ? (
              <GroupWallCreateCard onClick={openCreateGroup} label="New group" hint="Organize screens" />
            ) : null}
          </ul>
        ) : (
          <ul className="device-group-wall-list rounded-lg border border-border bg-card shadow-sm">
            {entries.map(({ group, deviceCount, onlineCount }) => (
              <DeviceGroupWallListRowFromGroup
                key={group.id}
                group={group}
                itemCount={deviceCount}
                onlineCount={onlineCount}
                onOpen={() => router.push(groupDetailPath(group.id, adminRoutes))}
                onEdit={readOnly ? undefined : () => openEditGroup(group)}
              />
            ))}
            {!readOnly ? (
              <GroupWallCreateListRow onClick={openCreateGroup} label="New group" hint="Organize screens" />
            ) : null}
          </ul>
        )}
      </div>

      {ownerId ? (
        <DeviceGroupEditorDialog
          open={groupEditorOpen}
          mode={groupEditorMode}
          ownerId={ownerId}
          group={groupBeingEdited}
          devices={devices}
          onClose={() => {
            setGroupEditorOpen(false);
            void syncNow();
          }}
        />
      ) : null}
    </div>
  );
}
