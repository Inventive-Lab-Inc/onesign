import { describe, expect, it } from "vitest";
import {
  devicePlatformLabel,
  deviceReconnectSteps,
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

describe("deviceReconnectSteps", () => {
  it("returns short browser reconnect steps", () => {
    expect(deviceReconnectSteps("browser")).toEqual([
      "Open browser player",
      "Copy pairing code",
      "Enter below",
    ]);
  });

  it("returns short android reconnect steps", () => {
    expect(deviceReconnectSteps("android")).toEqual([
      "Open OneSign TV",
      "Copy pairing code",
      "Enter below",
    ]);
  });
});
