import { describe, expect, it } from "vitest";
import { mergeDeviceLastSeen } from "@/lib/device-presence";

describe("mergeDeviceLastSeen", () => {
  it("keeps the newer timestamp", () => {
    expect(
      mergeDeviceLastSeen("2026-06-16T12:00:00.000Z", "2026-06-16T12:00:30.000Z"),
    ).toBe("2026-06-16T12:00:30.000Z");
    expect(
      mergeDeviceLastSeen("2026-06-16T12:00:30.000Z", "2026-06-16T12:00:00.000Z"),
    ).toBe("2026-06-16T12:00:30.000Z");
  });

  it("falls back when one side is missing", () => {
    expect(mergeDeviceLastSeen(null, "2026-06-16T12:00:00.000Z")).toBe("2026-06-16T12:00:00.000Z");
    expect(mergeDeviceLastSeen("2026-06-16T12:00:00.000Z", null)).toBe("2026-06-16T12:00:00.000Z");
  });
});
