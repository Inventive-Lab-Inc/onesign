import { playerStorageKeys, readPlayerStorage, writePlayerStorage } from "./device-storage";

const BROWSER_PREFIX = "browser:";
const BROWSER_FINGERPRINT_PREFIX = `${BROWSER_PREFIX}fp:`;

/** Coarse browser signals that survive cookie/localStorage clears on the same machine. */
export function browserFingerprintSignals(): string[] {
  if (typeof navigator === "undefined" || typeof screen === "undefined") {
    return ["ssr"];
  }

  return [
    navigator.userAgent ?? "",
    navigator.language ?? "",
    getBrowserIanaTimezone(),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth ?? 0),
    String(window.devicePixelRatio ?? 1),
    String(navigator.hardwareConcurrency ?? 0),
    String(navigator.maxTouchPoints ?? 0),
    navigator.platform ?? "",
  ];
}

/** Deterministic hash for register_or_restore_device (android_id). */
export function hashBrowserFingerprint(signals: string[]): string {
  const input = signals.join("\u0000");
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 = (h2 + code * (i + 1)) | 0;
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

export function buildBrowserFingerprintClientId(): string {
  return `${BROWSER_FINGERPRINT_PREFIX}${hashBrowserFingerprint(browserFingerprintSignals())}`;
}

function isLegacyRandomBrowserId(value: string): boolean {
  return value.startsWith(BROWSER_PREFIX) && !value.startsWith(BROWSER_FINGERPRINT_PREFIX);
}

/**
 * Stable client id passed as p_android_id.
 *
 * Like Android's Settings.Secure.ANDROID_ID, the fingerprint id survives clearing
 * site data. Legacy random ids in localStorage are kept while present; after a
 * clear we fall back to the fingerprint so a linked screen can auto-restore.
 */
export function getBrowserDeviceClientId(): string {
  const fingerprintId = buildBrowserFingerprintClientId();
  const existing = readPlayerStorage(playerStorageKeys.browserDeviceId);

  if (existing?.startsWith(BROWSER_FINGERPRINT_PREFIX)) {
    if (existing === fingerprintId) {
      return existing;
    }
    writePlayerStorage(playerStorageKeys.browserDeviceId, fingerprintId);
    return fingerprintId;
  }

  if (existing && isLegacyRandomBrowserId(existing)) {
    return existing;
  }

  writePlayerStorage(playerStorageKeys.browserDeviceId, fingerprintId);
  return fingerprintId;
}

export function getBrowserIanaTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
