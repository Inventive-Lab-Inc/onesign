import type { DeviceHealthKind } from "@/lib/dashboard-device-health";
import { deviceUiTvCopy as copy } from "@/lib/device-ui-copy";

export type DeviceUiPhaseId =
  | "initializing"
  | "device-setup"
  | "pairing"
  | "playing"
  | "no-playlist"
  | "empty-playlist"
  | "off-hours-blank"
  | "off-hours-standby"
  | "disabled"
  | "paused-quota"
  | "account-suspended"
  | "missing-config"
  | "error-connection";

export type DeviceUiPhaseGroup = "setup" | "playback" | "blocked" | "errors";

export type DeviceUiPhase = {
  id: DeviceUiPhaseId;
  group: DeviceUiPhaseGroup;
  title: string;
  description: string;
  consoleHealth?: DeviceHealthKind;
  tvMessage?: string;
  tvHint?: string;
  tvDeviceName?: string;
  tvErrorCode?: string;
  tvBadge?: string;
  tvStatusLine?: string;
  tvPairingCode?: string;
  tvShowWaitingIndicator?: boolean;
  tvPrimaryAction?: string;
};

export const deviceUiPhaseGroups: { id: DeviceUiPhaseGroup; label: string; description: string }[] =
  [
    {
      id: "setup",
      label: "Setup & pairing",
      description: "Before a screen is linked and ready for content.",
    },
    {
      id: "playback",
      label: "Playback",
      description: "Normal operation and idle states while linked.",
    },
    {
      id: "blocked",
      label: "Paused & disabled",
      description: "Playback blocked — short badge + one hint line each.",
    },
    {
      id: "errors",
      label: "Errors & config",
      description: "Startup failures and misconfiguration.",
    },
  ];

const deviceUiScreenshotFileNames: Record<DeviceUiPhaseId, string> = {
  initializing: "initializing.png",
  "device-setup": "device-setup.png",
  pairing: "pairing.png",
  playing: "playing.png",
  "no-playlist": "no-playlist.png",
  "empty-playlist": "empty-playlist.png",
  "off-hours-blank": "off-hours-blank.png",
  "off-hours-standby": "off-hours-standby.png",
  disabled: "disabled.png",
  "paused-quota": "paused-quota.png",
  "account-suspended": "account-suspended.png",
  "missing-config": "missing-config.png",
  "error-connection": "error-connection.png",
};

export function deviceUiScreenshotPath(phaseId: DeviceUiPhaseId): string {
  return `/images/device-view/${deviceUiScreenshotFileNames[phaseId]}`;
}

export const deviceUiMockDeviceName = "Lobby Display";

export const deviceUiPhases: DeviceUiPhase[] = [
  {
    id: "initializing",
    group: "setup",
    title: "Starting",
    description: "Connects and registers on launch.",
    tvMessage: copy.initializing.message,
  },
  {
    id: "device-setup",
    group: "setup",
    title: "One-time TV setup",
    description: "Grant install permission once so updates can run unattended.",
  },
  {
    id: "pairing",
    group: "setup",
    title: "Pairing screen",
    description: "Six-digit code and link steps.",
    consoleHealth: "pending",
    tvPairingCode: "378694",
  },
  {
    id: "playing",
    group: "playback",
    title: "Playing content",
    description: "Full-screen slides; trial watermark and cache progress while loading.",
    consoleHealth: "playing",
  },
  {
    id: "no-playlist",
    group: "playback",
    title: "No playlist assigned",
    description: "Linked screen with no playlist.",
    consoleHealth: "idle",
    tvBadge: copy.noPlaylist.badge,
    tvDeviceName: deviceUiMockDeviceName,
    tvHint: copy.noPlaylist.hint,
  },
  {
    id: "empty-playlist",
    group: "playback",
    title: "Empty playlist",
    description: "Playlist assigned but no slides yet.",
    tvBadge: copy.emptyPlaylist.badge,
    tvDeviceName: deviceUiMockDeviceName,
    tvHint: copy.emptyPlaylist.hint,
  },
  {
    id: "off-hours-blank",
    group: "playback",
    title: "Off-hours · blank screen",
    description: 'Fully black when "Blank screen when off" is enabled.',
    consoleHealth: "off_hours",
  },
  {
    id: "off-hours-standby",
    group: "playback",
    title: "Off-hours · standby",
    description: "Branded standby outside operating hours.",
    consoleHealth: "off_hours",
    tvBadge: copy.offHoursStandby.badge,
    tvDeviceName: deviceUiMockDeviceName,
    tvHint: copy.offHoursStandby.hint,
  },
  {
    id: "disabled",
    group: "blocked",
    title: "Screen disabled by admin",
    description: "Admin turned off playback for this screen.",
    consoleHealth: "disabled",
    tvBadge: copy.disabled.badge,
    tvDeviceName: deviceUiMockDeviceName,
    tvHint: copy.disabled.hint,
  },
  {
    id: "paused-quota",
    group: "blocked",
    title: "Paused by plan limit",
    description: "Screen exceeds plan cap after a downgrade.",
    consoleHealth: "paused",
    tvBadge: copy.pausedQuota.badge,
    tvDeviceName: deviceUiMockDeviceName,
    tvHint: copy.pausedQuota.hint,
  },
  {
    id: "account-suspended",
    group: "blocked",
    title: "Account suspended",
    description: "Client account disabled.",
    consoleHealth: "suspended",
    tvBadge: copy.accountSuspended.badge,
    tvDeviceName: deviceUiMockDeviceName,
    tvHint: copy.accountSuspended.hint,
  },
  {
    id: "missing-config",
    group: "errors",
    title: "Can't start the app",
    description: "Incomplete or broken install — user should reinstall the app.",
    tvBadge: copy.missingConfig.badge,
    tvHint: copy.missingConfig.hint,
  },
  {
    id: "error-connection",
    group: "errors",
    title: "Can't connect to the internet",
    description: "Player cannot reach OneSign — check network and retry.",
    tvBadge: copy.errorConnection.badge,
    tvHint: copy.errorConnection.hint,
    tvPrimaryAction: copy.errorConnection.action,
  },
];

export function getDeviceUiPhase(phaseId: DeviceUiPhaseId): DeviceUiPhase | undefined {
  return deviceUiPhases.find((phase) => phase.id === phaseId);
}
