import { playerStorageKeys, readPlayerStorage, writePlayerStorage } from "./device-storage";

const BROWSER_PREFIX = "browser:";

function createBrowserUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Stable client id passed as p_android_id (browser:{uuid}). */
export function getBrowserDeviceClientId(): string {
  const existing = readPlayerStorage(playerStorageKeys.browserDeviceId);
  if (existing?.startsWith(BROWSER_PREFIX)) {
    return existing;
  }

  const clientId = `${BROWSER_PREFIX}${createBrowserUuid()}`;
  writePlayerStorage(playerStorageKeys.browserDeviceId, clientId);
  return clientId;
}

export function getBrowserIanaTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
