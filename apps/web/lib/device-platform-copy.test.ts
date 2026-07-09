import { describe, expect, it } from "vitest";
import {
  devicePlatformLabel,
  devicePlatformPairingHint,
  parseRebindPlatformMismatch,
} from "./device-platform-copy";

describe("devicePlatformLabel", () => {
  it("labels browser player separately from android app", () => {
    expect(devicePlatformLabel("browser")).toBe("Browser player");
    expect(devicePlatformLabel("android")).toBe("Android TV app");
  });
});

describe("parseRebindPlatformMismatch", () => {
  it("parses hint from platform_mismatch errors", () => {
    expect(
      parseRebindPlatformMismatch("platform_mismatch", "android->browser"),
    ).toEqual({
      screenPlatform: "android",
      playerPlatform: "browser",
    });
  });

  it("returns null for other errors", () => {
    expect(parseRebindPlatformMismatch("invalid_pairing_code", null)).toBeNull();
  });
});

describe("devicePlatformPairingHint", () => {
  it("points browser screens at the web player", () => {
    expect(devicePlatformPairingHint("browser")).toContain("player.onesigntv.com");
    expect(devicePlatformPairingHint("browser")).toContain("Android phones");
  });

  it("points android screens at the native TV app", () => {
    expect(devicePlatformPairingHint("android")).toContain("OneSign TV app");
  });
});
