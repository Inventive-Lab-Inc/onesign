import type { PlaybackManifest } from "./playback-types";
import { playerStorageKeys, readPlayerStorage, removePlayerStorage, writePlayerStorage } from "./device-storage";

export type CachedPlaybackV1 = {
  deviceId: string;
  deviceDisplayName: string;
  playlistName: string | null;
  contentRevision: string | null;
  playlistId: string | null;
  savedAtMs: number;
  slides: PlaybackManifest["slides"];
  screenOrientation: PlaybackManifest["screenOrientation"];
  transitionStyle: string;
  shuffleEnabled: boolean;
  showTrialWatermark: boolean;
};

export function readCachedPlayback(deviceId: string): CachedPlaybackV1 | null {
  const raw = readPlayerStorage(playerStorageKeys.cachedPlayback);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedPlaybackV1;
    if (parsed.deviceId !== deviceId || !Array.isArray(parsed.slides)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedPlayback(manifest: PlaybackManifest): void {
  const payload: CachedPlaybackV1 = {
    deviceId: manifest.deviceId,
    deviceDisplayName: manifest.deviceName,
    playlistName: manifest.playlistName,
    contentRevision: manifest.contentRevision,
    playlistId: manifest.playlistId,
    savedAtMs: Date.now(),
    slides: manifest.slides,
    screenOrientation: manifest.screenOrientation,
    transitionStyle: manifest.transitionStyle,
    shuffleEnabled: manifest.shuffleEnabled,
    showTrialWatermark: manifest.showTrialWatermark,
  };
  writePlayerStorage(playerStorageKeys.cachedPlayback, JSON.stringify(payload));
}

export function clearCachedPlayback(): void {
  removePlayerStorage(playerStorageKeys.cachedPlayback);
}

export function manifestFromCache(cached: CachedPlaybackV1): PlaybackManifest {
  return {
    deviceId: cached.deviceId,
    deviceName: cached.deviceDisplayName || "Display",
    playlistName: cached.playlistName,
    playlistId: cached.playlistId,
    slides: cached.slides,
    contentRevision: cached.contentRevision,
    screenOrientation: cached.screenOrientation,
    transitionStyle: cached.transitionStyle,
    shuffleEnabled: cached.shuffleEnabled,
    showTrialWatermark: cached.showTrialWatermark,
    playbackDisabled: false,
    playbackBlockReason: null,
    outsideOperatingHours: false,
    blankWhenOffHours: false,
    isFromCache: true,
  };
}
