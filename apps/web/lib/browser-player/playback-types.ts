import type { DeviceScreenOrientation } from "@signage/types";

export type PlaybackBlockReason = "account_suspended" | "paused_by_quota" | "admin_disabled";

export type PlaybackSlide = {
  url: string;
  fileType: "image" | "video" | "website" | string;
  durationSeconds: number | null;
  zoomLevel: number | null;
};

export type PlaybackManifest = {
  deviceName: string;
  deviceId: string;
  playlistName: string | null;
  playlistId: string | null;
  slides: PlaybackSlide[];
  contentRevision: string | null;
  screenOrientation: DeviceScreenOrientation;
  transitionStyle: string;
  shuffleEnabled: boolean;
  showTrialWatermark: boolean;
  playbackDisabled: boolean;
  playbackBlockReason: PlaybackBlockReason | null;
  outsideOperatingHours: boolean;
  blankWhenOffHours: boolean;
  isFromCache: boolean;
};

export type PlaybackRevision = {
  ok: boolean;
  deviceName: string | null;
  contentRevision: string | null;
  playlistId: string | null;
  playlistName: string | null;
  screenOrientation: DeviceScreenOrientation;
  playbackDisabled: boolean;
  playbackBlockReason: PlaybackBlockReason | null;
  showTrialWatermark: boolean;
  screenshotRequestedAt: string | null;
  playbackSecret: string | null;
};

export type RegisterDeviceResult = {
  device_id: string;
  is_new: boolean;
  status: string;
  pairing_code: string;
  owner_id: string | null;
  playback_disabled: boolean;
  platform?: string;
};

export type TvPlaybackSlideRaw = {
  fileType: string;
  durationSeconds: number | null;
  storagePath: string;
  zoomLevel?: number | null;
};

export type TvPlaybackSlidesResponse = {
  ok: boolean;
  deviceName?: string;
  playbackDisabled?: boolean;
  playbackBlockReason?: string | null;
  outsideOperatingHours?: boolean;
  blankWhenOffHours?: boolean;
  playbackSecret?: string | null;
  playlistName?: string | null;
  slides?: TvPlaybackSlideRaw[];
  contentRevision?: string | null;
  playlistId?: string | null;
  transitionStyle?: string;
  shuffleEnabled?: boolean;
  showTrialWatermark?: boolean;
};

export type BrowserPlayerPhase =
  | "initializing"
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

export type MediaCacheProgress = {
  headline: string;
  percent: number | null;
};

export const POLL_INTERVAL_MS = 5_000;
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const TELEMETRY_INTERVAL_MS = 60_000;

export function normalizeScreenOrientation(value: string | null | undefined): DeviceScreenOrientation {
  switch (value) {
    case "portrait":
    case "reverse_landscape":
    case "reverse_portrait":
      return value;
    case "portrait_flipped":
      return "reverse_portrait";
    case "landscape_flipped":
      return "reverse_landscape";
    default:
      return "landscape";
  }
}

export function parsePlaybackBlockReason(value: string | null | undefined): PlaybackBlockReason | null {
  switch (value) {
    case "account_suspended":
    case "paused_by_quota":
    case "admin_disabled":
      return value;
    default:
      return null;
  }
}

export function imageSlideDwellMs(durationSeconds: number | null | undefined, fadeInMillis: number): number {
  const slideMs = Math.min(120, Math.max(1, durationSeconds ?? 8)) * 1000;
  return Math.max(0, slideMs - Math.max(0, fadeInMillis));
}

export function imageTransitionMillis(transitionStyle: string, fromType: string, toType: string): number {
  if (fromType !== "image" || toType !== "image") return 0;
  switch (transitionStyle.toLowerCase()) {
    case "fade":
      return 450;
    case "dissolve":
      return 650;
    default:
      return 0;
  }
}
