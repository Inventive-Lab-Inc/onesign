const DEVICE_ID_KEY = "onesign_browser_device_id";
const PLAYER_DEVICE_ID_KEY = "onesign_player_device_id";
const PLAYER_PAIRING_CODE_KEY = "onesign_player_pairing_code";
const PLAYER_PLAYBACK_SECRET_KEY = "onesign_player_playback_secret";
const CACHED_PLAYBACK_KEY = "onesign_player_cached_playback_v1";

export const playerStorageKeys = {
  browserDeviceId: DEVICE_ID_KEY,
  deviceId: PLAYER_DEVICE_ID_KEY,
  pairingCode: PLAYER_PAIRING_CODE_KEY,
  playbackSecret: PLAYER_PLAYBACK_SECRET_KEY,
  cachedPlayback: CACHED_PLAYBACK_KEY,
} as const;

export function readPlayerStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePlayerStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

export function removePlayerStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function clearPlayerRegistration(): void {
  removePlayerStorage(PLAYER_DEVICE_ID_KEY);
  removePlayerStorage(PLAYER_PAIRING_CODE_KEY);
  removePlayerStorage(PLAYER_PLAYBACK_SECRET_KEY);
  removePlayerStorage(CACHED_PLAYBACK_KEY);
}

export function readPlaybackSecret(): string | null {
  const value = readPlayerStorage(PLAYER_PLAYBACK_SECRET_KEY);
  return value?.trim() ? value : null;
}

export function persistPlaybackSecret(secret: string | null | undefined): void {
  const trimmed = secret?.trim();
  if (trimmed) {
    writePlayerStorage(PLAYER_PLAYBACK_SECRET_KEY, trimmed);
  }
}

export function persistRegistration(deviceId: string, pairingCode: string): void {
  writePlayerStorage(PLAYER_DEVICE_ID_KEY, deviceId);
  writePlayerStorage(PLAYER_PAIRING_CODE_KEY, pairingCode);
}
