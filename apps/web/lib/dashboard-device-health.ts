import type { DeviceStatus, Playlist, PlaylistItemWithMedia } from "@signage/types";
import type { ActiveAppRelease } from "@/hooks/use-active-app-release";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import {
  deviceAppUpdateStatus,
  deviceInstalledAppLabel,
  getDeviceInstalledApp,
} from "@/lib/device-app-version";
import { deviceDisabledPresentation } from "@/components/device-disabled-notice";
import { deviceHasConfiguredOperatingHours, isDeviceOutsideOperatingHours } from "@/lib/device-operating-hours";
import { getDeviceMediaCache } from "@/lib/device-media-cache";
import { findGroupContainingDevice } from "@/lib/group-playlist";
import { effectiveDeviceStatus, formatDeviceLastSeen } from "@/lib/device-status";

export type PlaylistAssignmentSource = "screen" | "group" | "none";

export type DeviceHealthKind =
  | "playing"
  | "idle"
  | "offline"
  | "offline_expected"
  | "off_hours"
  | "pending"
  | "paused"
  | "disabled"
  | "suspended";

export type DeviceAttentionKind =
  | "offline_unexpected"
  | "pending_pairing"
  | "playback_blocked"
  | "no_playlist"
  | "app_update"
  | "cache_syncing";

export type DashboardDeviceAttention = {
  kind: DeviceAttentionKind;
  label: string;
  detail?: string;
};

export type DashboardDeviceRow = {
  device: DeviceWithAssignments;
  status: DeviceStatus;
  health: DeviceHealthKind;
  healthLabel: string;
  healthDetail: string | null;
  attentionScore: number;
  attentionIssues: DashboardDeviceAttention[];
  playlistId: string | null;
  playlistName: string;
  playlistItemCount: number;
  assignmentSource: PlaylistAssignmentSource;
  groupName: string | null;
  lastSeenLabel: string;
  appVersionLabel: string | null;
  previewImageKind: "live" | "thumbnail" | "none";
};

function activePlaylistRow(device: DeviceWithAssignments) {
  const rows = device.device_playlists;
  if (!rows?.length) return null;
  return rows.find((row) => row.is_active) ?? null;
}

function resolvePlaylistAssignment(
  device: DeviceWithAssignments,
  deviceGroups: DeviceGroupWithMembers[],
  playlists: Playlist[],
): {
  playlistId: string | null;
  playlistName: string;
  assignmentSource: PlaylistAssignmentSource;
  groupName: string | null;
} {
  const active = activePlaylistRow(device);
  const group = findGroupContainingDevice(deviceGroups, device.id);
  const playlistId = active?.playlist_id ?? null;

  if (!playlistId) {
    return { playlistId: null, playlistName: "No playlist", assignmentSource: "none", groupName: group?.name ?? null };
  }

  const playlist = playlists.find((entry) => entry.id === playlistId);
  const playlistName = playlist?.name ?? `${playlistId.slice(0, 8)}…`;
  const assignmentSource: PlaylistAssignmentSource =
    group?.playlist_id && group.playlist_id === playlistId ? "group" : "screen";

  return {
    playlistId,
    playlistName,
    assignmentSource,
    groupName: group?.name ?? null,
  };
}

function healthPresentation(input: {
  status: DeviceStatus;
  disabled: ReturnType<typeof deviceDisabledPresentation>;
  outsideHours: boolean;
  blankWhenOff: boolean;
  hasPlaylist: boolean;
  offlineExpected: boolean;
}): { health: DeviceHealthKind; healthLabel: string; healthDetail: string | null } {
  if (input.status === "pending_pairing") {
    return { health: "pending", healthLabel: "Pending setup", healthDetail: "Finish pairing on the TV" };
  }

  if (input.disabled.accountSuspended) {
    return { health: "suspended", healthLabel: "Account suspended", healthDetail: "Playback paused by admin" };
  }

  if (input.disabled.pausedByQuota) {
    return { health: "paused", healthLabel: "Plan limit", healthDetail: "Screen paused — upgrade or free a slot" };
  }

  if (input.disabled.show) {
    return { health: "disabled", healthLabel: "Screen disabled", healthDetail: "Disabled by admin" };
  }

  if (input.status === "offline") {
    if (input.offlineExpected) {
      return { health: "offline_expected", healthLabel: "Offline", healthDetail: "Outside scheduled hours" };
    }
    return { health: "offline", healthLabel: "Unreachable", healthDetail: "Player has not checked in recently" };
  }

  if (input.outsideHours) {
    return {
      health: "off_hours",
      healthLabel: input.blankWhenOff ? "Off-hours · blank" : "Off-hours",
      healthDetail: input.blankWhenOff ? "Screen blanks outside its schedule" : "Outside configured hours",
    };
  }

  if (!input.hasPlaylist) {
    return { health: "idle", healthLabel: "No content", healthDetail: "Assign a playlist to start playback" };
  }

  return { health: "playing", healthLabel: "Playing", healthDetail: "Reachable and scheduled to show content" };
}

function buildAttentionIssues(input: {
  health: DeviceHealthKind;
  status: DeviceStatus;
  hasPlaylist: boolean;
  appUpdate: boolean;
  cacheWarming: boolean;
  cachePartial: boolean;
}): DashboardDeviceAttention[] {
  const issues: DashboardDeviceAttention[] = [];

  if (input.status === "pending_pairing") {
    issues.push({ kind: "pending_pairing", label: "Finish pairing" });
  }

  if (input.health === "suspended" || input.health === "paused" || input.health === "disabled") {
    issues.push({ kind: "playback_blocked", label: "Playback blocked" });
  }

  if (input.health === "offline") {
    issues.push({ kind: "offline_unexpected", label: "Unreachable" });
  }

  if (!input.hasPlaylist && input.health !== "pending" && input.health !== "offline_expected") {
    issues.push({ kind: "no_playlist", label: "No playlist" });
  }

  if (input.appUpdate) {
    issues.push({ kind: "app_update", label: "App update" });
  }

  if (input.cacheWarming || input.cachePartial) {
    issues.push({
      kind: "cache_syncing",
      label: input.cacheWarming ? "Syncing media" : "Cache incomplete",
    });
  }

  return issues;
}

function attentionScoreFor(health: DeviceHealthKind, issues: DashboardDeviceAttention[]): number {
  let score = 0;
  for (const issue of issues) {
    switch (issue.kind) {
      case "pending_pairing":
        score = Math.max(score, 100);
        break;
      case "playback_blocked":
        score = Math.max(score, 95);
        break;
      case "offline_unexpected":
        score = Math.max(score, 85);
        break;
      case "no_playlist":
        score = Math.max(score, 70);
        break;
      case "app_update":
        score = Math.max(score, 45);
        break;
      case "cache_syncing":
        score = Math.max(score, 35);
        break;
      default:
        break;
    }
  }

  if (health === "offline_expected") {
    score = Math.max(score, 8);
  }

  if (health === "playing") {
    score = Math.min(score, 5);
  }

  return score;
}

export function buildDashboardDeviceRow(
  device: DeviceWithAssignments,
  options: {
    deviceGroups: DeviceGroupWithMembers[];
    playlists: Playlist[];
    playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
    activeAppRelease: ActiveAppRelease | null;
    accountDisabled?: boolean;
  },
): DashboardDeviceRow {
  const status = effectiveDeviceStatus(device);
  const disabled = deviceDisabledPresentation(device, options.accountDisabled ?? false);
  const outsideHours = isDeviceOutsideOperatingHours(device);
  const offlineExpected =
    status === "offline" && deviceHasConfiguredOperatingHours(device) && outsideHours;
  const playlist = resolvePlaylistAssignment(device, options.deviceGroups, options.playlists);
  const playlistItemCount = playlist.playlistId
    ? (options.playlistItemsByPlaylistId[playlist.playlistId]?.length ?? 0)
    : 0;
  const hasPlaylist = playlist.playlistId != null && playlistItemCount > 0;
  const { health, healthLabel, healthDetail } = healthPresentation({
    status,
    disabled,
    outsideHours,
    blankWhenOff: Boolean(device.blank_when_off_hours),
    hasPlaylist: playlist.playlistId != null,
    offlineExpected,
  });

  const installed = getDeviceInstalledApp(device);
  const appStatus = deviceAppUpdateStatus(installed, options.activeAppRelease);
  const cache = getDeviceMediaCache(device);
  const cacheWarming = cache?.warming === true;
  const cachePartial =
    cache != null &&
    cache.items_total != null &&
    cache.items_ready != null &&
    cache.items_ready < cache.items_total;

  const attentionIssues = buildAttentionIssues({
    health,
    status,
    hasPlaylist,
    appUpdate: appStatus === "update_available",
    cacheWarming,
    cachePartial,
  });

  const previewImageKind: DashboardDeviceRow["previewImageKind"] = device.live_screenshot_at
    ? "live"
    : device.thumbnail_storage_path
      ? "thumbnail"
      : "none";

  return {
    device,
    status,
    health,
    healthLabel,
    healthDetail,
    attentionScore: attentionScoreFor(health, attentionIssues),
    attentionIssues,
    playlistId: playlist.playlistId,
    playlistName: playlist.playlistName,
    playlistItemCount,
    assignmentSource: playlist.assignmentSource,
    groupName: playlist.groupName,
    lastSeenLabel: formatDeviceLastSeen(device.last_seen),
    appVersionLabel: deviceInstalledAppLabel(installed),
    previewImageKind,
  };
}

export function buildDashboardDeviceRows(
  devices: DeviceWithAssignments[],
  options: Omit<Parameters<typeof buildDashboardDeviceRow>[1], never>,
): DashboardDeviceRow[] {
  return devices
    .map((device) => buildDashboardDeviceRow(device, options))
    .sort((a, b) => {
      if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
      return a.device.name.localeCompare(b.device.name);
    });
}

export function summarizeFleetAttention(rows: DashboardDeviceRow[]) {
  const needsAttention = rows.filter((row) => row.attentionScore >= 35);
  const offlineUnexpected = rows.filter((row) => row.health === "offline").length;
  const playing = rows.filter((row) => row.health === "playing").length;
  const inGroups = rows.filter((row) => row.groupName != null).length;

  return {
    needsAttention,
    offlineUnexpected,
    playing,
    inGroups,
    allHealthy: needsAttention.length === 0,
  };
}
