"use client";

import type { Device, DeviceStatus } from "@signage/types";
import { ArrowLeft, FolderOutput, LayoutGrid, Link2, List, Monitor, Search, Settings, Trash2, Tv, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { deviceDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { PlanUsageMeter } from "@/components/plan/plan-usage-meter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import { effectiveDeviceStatus, formatDeviceLastSeen } from "@/lib/device-status";
import { groupFilterLabel, parseGroupFilterFromSearchParam } from "@/lib/device-group-navigation";
import { useAppRouter } from "@/hooks/use-app-router";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { deviceTelemetrySummaryLine } from "@/components/device-telemetry-panel";
import { DeviceMediaCacheChip } from "@/components/device-media-cache-chip";
import { DeviceAppVersionChip } from "@/components/device-app-version-chip";
import { DeviceDisabledBadge, deviceDisabledPresentation, isDevicePausedByQuota } from "@/components/device-disabled-notice";
import { DevicePlaybackPowerButton } from "@/components/device-playback-toggle";
import { useActiveAppRelease, type ActiveAppRelease } from "@/hooks/use-active-app-release";
import { deviceAppUpdateStatus, getDeviceInstalledApp } from "@/lib/device-app-version";
import { DeviceGroupChip } from "@/components/device-groups/device-group-chip";
import { DeviceGroupEditorDialog } from "@/components/device-groups/device-group-editor-dialog";
import { DeviceGroupFolderCard, DeviceGroupFolderCardFromGroup, DeviceGroupFolderListRowFromGroup, GroupFolderCreateCard, GroupFolderCreateListRow } from "@/components/device-groups/device-group-folder-card";
import { DeviceScreenCard } from "@/components/devices/device-screen-card";
import { DeviceAddToFolderButton } from "@/components/devices/device-add-to-folder-button";
import "@/components/device-groups/device-groups.css";

type StatusFilter = "all" | DeviceStatus;

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
        status === "online" && "bg-brand-soft text-brand-badge dark:text-brand-onDark",
        status === "offline" && "bg-muted text-muted-foreground",
        status === "pending_pairing" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function deviceCardActionButtonClass(variant: "secondary" | "outline") {
  return cn(
    buttonVariants({ variant, size: "sm" }),
    "h-8 w-8 p-0 transition-all duration-150 hover:shadow-sm active:scale-[0.97]",
    variant === "secondary" ? "hover:bg-muted/90" : "hover:bg-muted/60",
  );
}

function DeviceModelChip({ model }: { model: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full border border-border/80 bg-background/90 px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground shadow-sm"
      title={model}
    >
      <span className="truncate">{model}</span>
    </span>
  );
}

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: typeof Monitor }[] = [
  { id: "all", label: "All", icon: Monitor },
  { id: "online", label: "Online", icon: Wifi },
  { id: "offline", label: "Offline", icon: WifiOff },
  { id: "pending_pairing", label: "Pending", icon: Link2 },
];

export function DevicesManager() {
  useStaleOnlineTick();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const devices = useConsoleDataStore((s) => s.devices) as DeviceWithAssignments[];
  const deviceGroups = useConsoleDataStore((s) => s.deviceGroups) as DeviceGroupWithMembers[];
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const activeAppRelease = useActiveAppRelease();

  const { syncNow } = useConsoleSync();
  const adminStaff = useOptionalAdminStaff();
  const adminRoutes = useAdminClientRoutes();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useAppRouter();
  const plan = usePlanQuota();
  const deviceLimit = plan?.deviceLimit ?? null;
  const accountDisabled = plan?.accountDisabled ?? false;
  const readOnly = adminStaff != null && !adminStaff.canWrite;
  const canControlPlayback = Boolean(adminStaff?.canWrite && !accountDisabled);

  const [pairingCode, setPairingCode] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [devicePendingDelete, setDevicePendingDelete] = useState<Device | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "edit">("create");
  const [groupBeingEdited, setGroupBeingEdited] = useState<DeviceGroupWithMembers | null>(null);

  const refreshAfterMutation = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  async function linkDevice() {
    if (readOnly) return;
    if (deviceLimit != null && devices.length >= deviceLimit) {
      toast.error(`Screen limit reached (${deviceLimit}). Contact support to add more.`);
      return;
    }
    setLinking(true);
    try {
      const code = pairingCode.trim();
      if (!/^[0-9]{6}$/.test(code)) {
        toast.error("Pairing code must be exactly 6 digits.");
        return;
      }
      const ownerId = adminRoutes?.clientId ?? null;
      const { data, error } = await supabase.rpc("link_device_by_pairing_code", {
        p_code: code,
        p_name: friendlyName.trim() || null,
        p_owner_id: ownerId,
      });
      if (error) {
        if (error.message.includes("device_limit_reached")) {
          toast.error(
            `You've reached your screen limit (${deviceLimit ?? "plan limit"}). Remove a screen or upgrade your plan.`,
          );
        } else if (error.message.includes("trial_expired")) {
          toast.error("Your trial has ended. Contact us to upgrade and link more screens.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success(`Linked device ${(data as Device).name}`);
      setPairingCode("");
      setFriendlyName("");
      await refreshAfterMutation();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to link device";
      toast.error(message);
    } finally {
      setLinking(false);
    }
  }

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

  const ungroupedCount = useMemo(
    () => devices.filter((d) => !groupedDeviceIds.has(d.id)).length,
    [devices, groupedDeviceIds],
  );

  const groupFilter = useMemo(
    () => parseGroupFilterFromSearchParam(searchParams.get("group"), deviceGroups),
    [searchParams, deviceGroups],
  );

  const activeGroup = useMemo(
    () => (groupFilter !== "all" && groupFilter !== "ungrouped"
      ? deviceGroups.find((g) => g.id === groupFilter) ?? null
      : null),
    [deviceGroups, groupFilter],
  );

  const navigateToGroup = useCallback(
    (filter: typeof groupFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (filter === "all") {
        params.delete("group");
      } else {
        params.set("group", filter);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const activeGroupName = groupFilterLabel(groupFilter, activeGroup);

  const filtered = useMemo(() => {
    let list = devices;
    if (statusFilter !== "all") {
      list = list.filter((d) => effectiveDeviceStatus(d) === statusFilter);
    }
    if (groupFilter === "ungrouped") {
      list = list.filter((d) => !groupedDeviceIds.has(d.id));
    } else if (groupFilter !== "all") {
      const memberIds = new Set(activeGroup?.member_device_ids ?? []);
      list = list.filter((d) => memberIds.has(d.id));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [devices, statusFilter, search, groupFilter, groupedDeviceIds, activeGroup]);

  const statusFilteredDevices = useMemo(() => {
    if (statusFilter === "all") return devices;
    return devices.filter((d) => effectiveDeviceStatus(d) === statusFilter);
  }, [devices, statusFilter]);

  const folderEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const entries = deviceGroups.map((group) => {
      const memberDevices = group.member_device_ids
        .map((id) => statusFilteredDevices.find((d) => d.id === id))
        .filter((d): d is DeviceWithAssignments => d != null);
      const onlineCount = memberDevices.filter((d) => effectiveDeviceStatus(d) === "online").length;
      return { group, memberDevices, deviceCount: memberDevices.length, onlineCount };
    });

    if (!q) {
      return entries;
    }

    return entries.filter(
      (entry) =>
        entry.group.name.toLowerCase().includes(q) ||
        entry.memberDevices.some((d) => d.name.toLowerCase().includes(q)),
    );
  }, [deviceGroups, statusFilteredDevices, search]);

  const ungroupedDevices = useMemo(() => {
    const memberDevices = statusFilteredDevices.filter((d) => !groupedDeviceIds.has(d.id));
    const q = search.trim().toLowerCase();
    if (!q) return memberDevices;
    return memberDevices.filter((d) => d.name.toLowerCase().includes(q));
  }, [statusFilteredDevices, groupedDeviceIds, search]);

  const isLibraryRoot = groupFilter === "all" || groupFilter === "ungrouped";
  const isInsideFolder = !isLibraryRoot;
  const backNavLabel = view === "grid" ? "Back to folders" : "Back to all screens";

  const showFolderBrowser = isLibraryRoot && !search.trim();
  const showSearchBrowser = isLibraryRoot && search.trim().length > 0;
  const showFolderContents = isInsideFolder && !search.trim();

  const searchResultDevices = useMemo(() => {
    if (!showSearchBrowser) return [];
    const q = search.trim().toLowerCase();
    return statusFilteredDevices.filter((d) => d.name.toLowerCase().includes(q));
  }, [showSearchBrowser, search, statusFilteredDevices]);

  const ungroupedSearchDevices = useMemo(
    () => searchResultDevices.filter((d) => !groupedDeviceIds.has(d.id)),
    [searchResultDevices, groupedDeviceIds],
  );

  const groupedSearchDevices = useMemo(
    () => searchResultDevices.filter((d) => groupedDeviceIds.has(d.id)),
    [searchResultDevices, groupedDeviceIds],
  );

  const visibleFolderEntries = useMemo(
    () => (showSearchBrowser ? folderEntries.filter((e) => e.group.name.toLowerCase().includes(search.trim().toLowerCase())) : folderEntries),
    [folderEntries, showSearchBrowser, search],
  );

  const hasUngroupedDevices = ungroupedDevices.length > 0;

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

  const removeDeviceFromFolder = useCallback(
    async (device: Device) => {
      if (!activeGroup || readOnly) return;
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
        toast.success(`“${device.name}” moved to Ungrouped`);
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
        const message = err instanceof Error ? err.message : "Unable to remove screen from folder";
        toast.error(message);
      }
    },
    [activeGroup, readOnly, refreshAfterMutation, supabase],
  );

  const addDeviceToFolder = useCallback(
    async (device: Device, group: DeviceGroupWithMembers) => {
      if (readOnly) return;
      if (group.member_device_ids.includes(device.id)) {
        toast.error(`“${device.name}” is already in “${group.name}”`);
        return;
      }
      try {
        const { error } = await supabase
          .from("device_group_members")
          .insert({ group_id: group.id, device_id: device.id });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success(`“${device.name}” added to “${group.name}”`);
        useConsoleDataStore.setState((state) => ({
          deviceGroups: state.deviceGroups.map((entry) =>
            entry.id === group.id
              ? {
                  ...entry,
                  member_device_ids: [...entry.member_device_ids, device.id],
                }
              : entry,
          ),
        }));
        await refreshAfterMutation();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to add screen to folder";
        toast.error(message);
      }
    },
    [readOnly, refreshAfterMutation, supabase],
  );

  const folderDeviceActions = useMemo(
    () =>
      showFolderContents && activeGroup && !readOnly
        ? { onRemoveFromFolder: removeDeviceFromFolder, folderName: activeGroup.name }
        : { onRemoveFromFolder: undefined, folderName: undefined },
    [activeGroup, readOnly, removeDeviceFromFolder, showFolderContents],
  );

  const ungroupedDeviceActions = useMemo(
    () =>
      !readOnly
        ? {
            folders: deviceGroups,
            onAddToFolder: addDeviceToFolder,
            onCreateFolder: openCreateGroup,
          }
        : {
            folders: [] as DeviceGroupWithMembers[],
            onAddToFolder: undefined,
            onCreateFolder: undefined,
          },
    [addDeviceToFolder, deviceGroups, openCreateGroup, readOnly],
  );

  const onlineCount = useMemo(
    () => devices.filter((d) => effectiveDeviceStatus(d) === "online").length,
    [devices],
  );

  const updatePendingCount = useMemo(() => {
    if (!activeAppRelease) return 0;
    return devices.filter((d) => deviceAppUpdateStatus(getDeviceInstalledApp(d), activeAppRelease) === "update_available")
      .length;
  }, [activeAppRelease, devices]);

  const atDeviceLimit = deviceLimit != null && devices.length >= deviceLimit;
  const quotaPausedCount = devices.filter((d) => isDevicePausedByQuota(d)).length;

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="w-full shrink-0 space-y-4 lg:w-56 xl:w-60">
        {plan ? (
          <PlanUsageMeter
            variant="screens"
            used={devices.length}
            limit={plan.deviceLimit}
            layout="card"
            className="shadow-sm"
          />
        ) : null}

        {!readOnly ? (
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Link a screen
            </p>
            {deviceLimit != null ? (
              <p className="mb-3 text-xs tabular-nums text-muted-foreground">
                {devices.length} of {deviceLimit} screens linked
                {quotaPausedCount > 0
                  ? ` · ${quotaPausedCount} paused by plan`
                  : ""}
              </p>
            ) : null}
            {atDeviceLimit ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                You have reached your screen limit. Contact support if you need to link more devices.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pair-code" className="text-xs">
                    Pairing code
                  </Label>
                  <Input
                    id="pair-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="h-9 font-mono text-sm tracking-widest"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pair-name" className="text-xs">
                    Display name
                  </Label>
                  <Input
                    id="pair-name"
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                    placeholder="Lobby screen"
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  className="h-10 w-full gap-2 font-semibold shadow-sm"
                  onClick={() => void linkDevice()}
                  disabled={linking}
                >
                  <Tv className="h-4 w-4" strokeWidth={2.25} />
                  {linking ? "Linking…" : "Link device"}
                </Button>
              </div>
            )}
            {!atDeviceLimit ? (
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
                Enter the six-digit code from the TV after it signs in. List is cached locally—use Sync in the
                header to refresh.
              </p>
            ) : null}
          </div>
        ) : null}

        <nav className="rounded-xl border border-border bg-muted/30 p-2" aria-label="Filter by status">
          <p className="mb-2 px-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
          <ul className="space-y-0.5">
            {STATUS_FILTERS.map(({ id, label, icon: Icon }) => {
              const active = statusFilter === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setStatusFilter(id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
                      active
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex min-h-full flex-col rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                {isInsideFolder ? (
                  <button
                    type="button"
                    onClick={() => navigateToGroup("all")}
                    aria-label={backNavLabel}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong shadow-sm transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-brand-onDark"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2.25} />
                  </button>
                ) : null}
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => navigateToGroup("all")}
                    className={cn(
                      "transition-colors",
                      groupFilter === "all"
                        ? "text-foreground"
                        : "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
                    )}
                    disabled={groupFilter === "all"}
                  >
                    Screens
                  </button>
                  {isInsideFolder ? (
                    <>
                      <span className="text-muted-foreground/70">/</span>
                      <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">
                        {activeGroupName}
                      </span>
                    </>
                  ) : showFolderBrowser ? (
                    <>
                      <span className="text-muted-foreground/70">/</span>
                      <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">
                        Folders
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground/70">/</span>
                      <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-normal text-foreground">
                        All devices
                      </span>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {showFolderBrowser ? (
                  <>
                    {visibleFolderEntries.length} folder{visibleFolderEntries.length === 1 ? "" : "s"}
                    {hasUngroupedDevices ? (
                      <>
                        {" "}
                        · {ungroupedDevices.length} ungrouped
                        {!readOnly ? " · use Add to folder on ungrouped screens" : ""}
                      </>
                    ) : null}
                    {" · "}
                    {devices.length} screen{devices.length === 1 ? "" : "s"}
                  </>
                ) : showSearchBrowser ? (
                  <>
                    {searchResultDevices.length} matching screen{searchResultDevices.length === 1 ? "" : "s"}
                    {visibleFolderEntries.length > 0 ? (
                      <>
                        {" "}
                        · {visibleFolderEntries.length} folder{visibleFolderEntries.length === 1 ? "" : "s"}
                      </>
                    ) : null}
                  </>
                ) : showFolderContents ? (
                  <>
                    {filtered.length} screen{filtered.length === 1 ? "" : "s"} in this folder
                    {!readOnly ? " · use Remove from folder to move a screen to Ungrouped" : ""}
                  </>
                ) : (
                  <>
                    {filtered.length} screen{filtered.length === 1 ? "" : "s"}
                    {devices.length !== filtered.length ? ` (${devices.length} total)` : ""}
                    {devices.length > 0 ? (
                      <>
                        {" "}
                        · {onlineCount} online
                        {updatePendingCount > 0 ? (
                          <>
                            {" "}
                            · {updatePendingCount} update{updatePendingCount === 1 ? "" : "s"} pending
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}
              </p>
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <div className="relative w-full min-w-0 sm:w-48 lg:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search screens…"
                  className="h-9 border-border bg-background pl-8 text-sm"
                  aria-label="Search devices"
                />
              </div>
              {!readOnly && showFolderContents && activeGroup ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5"
                  onClick={() => openEditGroup(activeGroup)}
                >
                  <Settings className="h-3.5 w-3.5" aria-hidden />
                  Manage folder
                </Button>
              ) : null}
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={cn(
                  "rounded-md p-1.5 text-muted-foreground transition-colors",
                  view === "grid" ? "bg-card text-foreground shadow-sm" : "hover:text-foreground",
                )}
                aria-pressed={view === "grid"}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "rounded-md p-1.5 text-muted-foreground transition-colors",
                  view === "list" ? "bg-card text-foreground shadow-sm" : "hover:text-foreground",
                )}
                aria-pressed={view === "list"}
                aria-label="List view"
              >
                <List className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            </div>
          </div>

          <div className="flex-1 p-4 sm:p-5">
            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Monitor className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-foreground">No screens linked yet</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Open the TV app, note the pairing code, then use <strong className="font-medium text-foreground">Link a screen</strong> on the
                  left.
                </p>
              </div>
            ) : showFolderBrowser ? (
              <div className="space-y-8">
                <DeviceFolderCollection
                  view={view}
                  entries={visibleFolderEntries}
                  readOnly={readOnly}
                  onOpenFolder={(groupId) => navigateToGroup(groupId)}
                  onEditFolder={openEditGroup}
                  onCreateFolder={openCreateGroup}
                />
                {hasUngroupedDevices ? (
                  <div className="space-y-4 border-t border-border pt-8">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Ungrouped</p>
                    <DeviceCollection
                      view={view}
                      devices={ungroupedDevices}
                      deviceGroupsByDeviceId={deviceGroupsByDeviceId}
                      activeAppRelease={activeAppRelease}
                      accountDisabled={accountDisabled}
                      canControlPlayback={canControlPlayback}
                      canDelete={!readOnly}
                      onRequestDelete={setDevicePendingDelete}
                      folders={ungroupedDeviceActions.folders}
                      onAddToFolder={ungroupedDeviceActions.onAddToFolder}
                      onCreateFolder={ungroupedDeviceActions.onCreateFolder}
                    />
                  </div>
                ) : null}
              </div>
            ) : showSearchBrowser ? (
              searchResultDevices.length === 0 && visibleFolderEntries.length === 0 && !readOnly ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No screens match</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">Try another search or status filter.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {visibleFolderEntries.length > 0 || !readOnly ? (
                    <div>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Folders</p>
                      <DeviceFolderCollection
                        view={view}
                        entries={visibleFolderEntries}
                        readOnly={readOnly}
                        onOpenFolder={(groupId) => {
                          setSearch("");
                          navigateToGroup(groupId);
                        }}
                        onEditFolder={openEditGroup}
                        onCreateFolder={openCreateGroup}
                      />
                    </div>
                  ) : null}
                  {ungroupedSearchDevices.length > 0 ? (
                    <div className="space-y-4 border-t border-border pt-6">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Ungrouped</p>
                      <DeviceCollection
                        view={view}
                        devices={ungroupedSearchDevices}
                        deviceGroupsByDeviceId={deviceGroupsByDeviceId}
                        activeAppRelease={activeAppRelease}
                        accountDisabled={accountDisabled}
                        canControlPlayback={canControlPlayback}
                        canDelete={!readOnly}
                        onRequestDelete={setDevicePendingDelete}
                        folders={ungroupedDeviceActions.folders}
                        onAddToFolder={ungroupedDeviceActions.onAddToFolder}
                        onCreateFolder={ungroupedDeviceActions.onCreateFolder}
                      />
                    </div>
                  ) : null}
                  {groupedSearchDevices.length > 0 ? (
                    <div className={ungroupedSearchDevices.length > 0 ? "space-y-4 border-t border-border pt-6" : ""}>
                      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">In folders</p>
                      <DeviceCollection
                        view={view}
                        devices={groupedSearchDevices}
                        deviceGroupsByDeviceId={deviceGroupsByDeviceId}
                        activeAppRelease={activeAppRelease}
                        accountDisabled={accountDisabled}
                        canControlPlayback={canControlPlayback}
                        canDelete={!readOnly}
                        onRequestDelete={setDevicePendingDelete}
                      />
                    </div>
                  ) : null}
                </div>
              )
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
                <p className="text-sm font-medium text-foreground">No screens match</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">Try another search or status filter.</p>
              </div>
            ) : view === "grid" ? (
              <DeviceCollection
                view="grid"
                devices={filtered}
                deviceGroupsByDeviceId={deviceGroupsByDeviceId}
                returnGroupId={isInsideFolder ? groupFilter : null}
                activeAppRelease={activeAppRelease}
                accountDisabled={accountDisabled}
                canControlPlayback={canControlPlayback}
                canDelete={!readOnly}
                onRequestDelete={setDevicePendingDelete}
                onRemoveFromFolder={folderDeviceActions.onRemoveFromFolder}
                folderName={folderDeviceActions.folderName}
              />
            ) : (
              <DeviceCollection
                view="list"
                devices={filtered}
                deviceGroupsByDeviceId={deviceGroupsByDeviceId}
                returnGroupId={isInsideFolder ? groupFilter : null}
                activeAppRelease={activeAppRelease}
                accountDisabled={accountDisabled}
                canControlPlayback={canControlPlayback}
                canDelete={!readOnly}
                onRequestDelete={setDevicePendingDelete}
                onRemoveFromFolder={folderDeviceActions.onRemoveFromFolder}
                folderName={folderDeviceActions.folderName}
              />
            )}
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={devicePendingDelete !== null}
        title={devicePendingDelete ? `Remove “${devicePendingDelete.name}”?` : "Remove screen?"}
        description="This disconnects the screen from your account. The TV will need to be paired again to show your content."
        confirmLabel="Remove screen"
        onClose={() => !deleteInProgress && setDevicePendingDelete(null)}
        onConfirm={confirmDeleteDevice}
        isConfirming={deleteInProgress}
      />

      {ownerId ? (
        <DeviceGroupEditorDialog
          open={groupEditorOpen}
          mode={groupEditorMode}
          ownerId={ownerId}
          group={groupBeingEdited}
          devices={devices}
          onClose={() => setGroupEditorOpen(false)}
        />
      ) : null}
    </div>
  );
}

type FolderEntry = {
  group: DeviceGroupWithMembers;
  deviceCount: number;
  onlineCount: number;
};

function DeviceFolderCollection({
  view,
  entries,
  readOnly,
  onOpenFolder,
  onEditFolder,
  onCreateFolder,
}: {
  view: "grid" | "list";
  entries: FolderEntry[];
  readOnly: boolean;
  onOpenFolder: (groupId: string) => void;
  onEditFolder: (group: DeviceGroupWithMembers) => void;
  onCreateFolder: () => void;
}) {
  if (view === "grid") {
    return (
      <ul className="device-group-folder-grid grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {entries.map(({ group, deviceCount, onlineCount }) => (
          <DeviceGroupFolderCardFromGroup
            key={group.id}
            group={group}
            itemCount={deviceCount}
            onlineCount={onlineCount}
            onOpen={() => onOpenFolder(group.id)}
            onEdit={readOnly ? undefined : () => onEditFolder(group)}
          />
        ))}
        {!readOnly ? (
          <GroupFolderCreateCard onClick={onCreateFolder} hint="Organize screens" />
        ) : null}
      </ul>
    );
  }

  return (
    <ul className="device-group-folder-list rounded-lg border border-border bg-card shadow-sm">
      {entries.map(({ group, deviceCount, onlineCount }) => (
        <DeviceGroupFolderListRowFromGroup
          key={group.id}
          group={group}
          itemCount={deviceCount}
          onlineCount={onlineCount}
          onOpen={() => onOpenFolder(group.id)}
          onEdit={readOnly ? undefined : () => onEditFolder(group)}
        />
      ))}
      {!readOnly ? (
        <GroupFolderCreateListRow onClick={onCreateFolder} hint="Organize screens" />
      ) : null}
    </ul>
  );
}

function DeviceCollection({
  view,
  devices,
  deviceGroupsByDeviceId,
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
  onCreateFolder,
}: {
  view: "grid" | "list";
  devices: DeviceWithAssignments[];
  deviceGroupsByDeviceId: Map<string, DeviceGroupWithMembers[]>;
  returnGroupId?: string | null;
  activeAppRelease: ActiveAppRelease | null;
  accountDisabled?: boolean;
  canControlPlayback?: boolean;
  canDelete?: boolean;
  onRequestDelete: (device: Device) => void;
  onRemoveFromFolder?: (device: Device) => void;
  folderName?: string;
  folders?: DeviceGroupWithMembers[];
  onAddToFolder?: (device: Device, group: DeviceGroupWithMembers) => void;
  onCreateFolder?: () => void;
}) {
  if (view === "grid") {
    return (
      <ul className="device-screen-grid grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {devices.map((device) => (
          <DeviceScreenCard
            key={device.id}
            device={device}
            groups={deviceGroupsByDeviceId.get(device.id) ?? []}
            returnGroupId={returnGroupId}
            activeAppRelease={activeAppRelease}
            accountDisabled={accountDisabled}
            canControlPlayback={canControlPlayback}
            canDelete={canDelete}
            onRequestDelete={() => onRequestDelete(device)}
            onRemoveFromFolder={onRemoveFromFolder ? () => onRemoveFromFolder(device) : undefined}
            folderName={folderName}
            folders={folders}
            onAddToFolder={
              onAddToFolder
                ? (groupId) => {
                    const group = folders.find((entry) => entry.id === groupId);
                    if (group) onAddToFolder(device, group);
                  }
                : undefined
            }
            onCreateFolder={onCreateFolder}
          />
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {devices.map((device) => (
        <DeviceListRow
          key={device.id}
          device={device}
          groups={deviceGroupsByDeviceId.get(device.id) ?? []}
          returnGroupId={returnGroupId}
          activeAppRelease={activeAppRelease}
          accountDisabled={accountDisabled}
          canControlPlayback={canControlPlayback}
          canDelete={canDelete}
          onRequestDelete={() => onRequestDelete(device)}
          onRemoveFromFolder={onRemoveFromFolder ? () => onRemoveFromFolder(device) : undefined}
          folderName={folderName}
          folders={folders}
          onAddToFolder={
            onAddToFolder
              ? (groupId) => {
                  const group = folders.find((entry) => entry.id === groupId);
                  if (group) onAddToFolder(device, group);
                }
              : undefined
          }
          onCreateFolder={onCreateFolder}
        />
      ))}
    </ul>
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
  onCreateFolder,
}: {
  device: Device;
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
  onCreateFolder?: () => void;
}) {
  const adminRoutes = useAdminClientRoutes();
  const deviceSummary = deviceTelemetrySummaryLine(device);
  const disabledState = deviceDisabledPresentation(device, accountDisabled);
  const detailHref = deviceDetailPath(device.id, adminRoutes, returnGroupId);
  return (
    <li className="relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:gap-4 sm:px-4">
      <Link
        href={detailHref}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Open screen: ${device.name}`}
      />
      <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-3 pointer-events-none sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border sm:h-11 sm:w-11">
          <Tv className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 lg:gap-6">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:w-[9.5rem] md:w-[11rem] lg:w-[12.5rem]">
            <p className="truncate text-sm font-semibold text-foreground" title={device.name}>
              {device.name}
            </p>
            {deviceSummary ? <DeviceModelChip model={deviceSummary} /> : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
            <StatusBadge status={effectiveDeviceStatus(device)} />
            {disabledState.show ? (
              <DeviceDisabledBadge
                accountSuspended={disabledState.accountSuspended}
                pausedByQuota={disabledState.pausedByQuota}
              />
            ) : null}
            {groups.map((group) => (
              <DeviceGroupChip key={group.id} name={group.name} accentColor={group.accent_color} />
            ))}
            <DeviceAppVersionChip device={device} activeRelease={activeAppRelease} compact />
            <DeviceMediaCacheChip device={device} compact />
          </div>

          <p className="hidden shrink-0 text-xs tabular-nums text-muted-foreground md:block lg:min-w-[7.5rem] lg:text-right">
            Active · {formatDeviceLastSeen(device.last_seen)}
          </p>
        </div>
      </div>

      <div className="relative z-[2] flex shrink-0 items-center gap-1">
        {onAddToFolder ? (
          <DeviceAddToFolderButton
            deviceName={device.name}
            folders={folders}
            onAddToFolder={onAddToFolder}
            onCreateFolder={onCreateFolder}
            layout="list"
          />
        ) : null}
        {onRemoveFromFolder ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            title={folderName ? `Remove from ${folderName}` : "Remove from folder"}
            aria-label={`Remove ${device.name} from folder`}
            className="h-8 gap-1.5 px-2.5 text-xs font-medium"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveFromFolder();
            }}
          >
            <FolderOutput className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="hidden xl:inline">Remove from folder</span>
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Remove ${device.name}`}
            className={cn(
              deviceCardActionButtonClass("outline"),
              "hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300",
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
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
        <Link
          href={detailHref}
          aria-label={`Settings for ${device.name}`}
          className={cn(
            deviceCardActionButtonClass("outline"),
            "hover:text-foreground",
          )}
        >
          <Settings className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </li>
  );
}
