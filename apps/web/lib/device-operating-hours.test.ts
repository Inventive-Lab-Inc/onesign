import { describe, expect, it } from "vitest";
import {
  deviceHasConfiguredOperatingHours,
  isDeviceInsideScheduleWindow,
  isDeviceOutsideOperatingHours,
} from "@/lib/device-operating-hours";

const baseDevice = {
  operating_hours_timezone: "UTC",
  operating_hours_timezone_auto: false,
  operating_hours_inverted: false,
  blank_when_off_hours: false,
  telemetry: null,
};

describe("device operating hours", () => {
  it("treats the default weekly schedule as always open", () => {
    const device = {
      ...baseDevice,
      operating_hours: {
        monday: { start: "00:00", end: "23:59" },
        tuesday: { start: "00:00", end: "23:59" },
        wednesday: { start: "00:00", end: "23:59" },
        thursday: { start: "00:00", end: "23:59" },
        friday: { start: "00:00", end: "23:59" },
        saturday: { start: "00:00", end: "23:59" },
        sunday: { start: "00:00", end: "23:59" },
      },
    };

    expect(deviceHasConfiguredOperatingHours(device)).toBe(false);
    expect(isDeviceOutsideOperatingHours(device, new Date("2026-06-16T12:00:00Z"))).toBe(false);
  });

  it("flags outside configured business hours", () => {
    const device = {
      ...baseDevice,
      operating_hours: {
        monday: { start: "09:00", end: "17:00" },
        tuesday: { start: "09:00", end: "17:00" },
        wednesday: { start: "09:00", end: "17:00" },
        thursday: { start: "09:00", end: "17:00" },
        friday: { start: "09:00", end: "17:00" },
        saturday: { start: "00:00", end: "00:00" },
        sunday: { start: "00:00", end: "00:00" },
      },
    };

    expect(deviceHasConfiguredOperatingHours(device)).toBe(true);
    expect(
      isDeviceInsideScheduleWindow(device, new Date("2026-06-16T15:00:00Z")),
    ).toBe(true);
    expect(
      isDeviceOutsideOperatingHours(device, new Date("2026-06-16T20:00:00Z")),
    ).toBe(true);
  });

  it("honors inverted operating hours", () => {
    const device = {
      ...baseDevice,
      operating_hours_inverted: true,
      operating_hours: {
        monday: { start: "09:00", end: "17:00" },
        tuesday: { start: "09:00", end: "17:00" },
        wednesday: { start: "09:00", end: "17:00" },
        thursday: { start: "09:00", end: "17:00" },
        friday: { start: "09:00", end: "17:00" },
        saturday: { start: "00:00", end: "00:00" },
        sunday: { start: "00:00", end: "00:00" },
      },
    };

    expect(
      isDeviceOutsideOperatingHours(device, new Date("2026-06-16T15:00:00Z")),
    ).toBe(true);
    expect(
      isDeviceOutsideOperatingHours(device, new Date("2026-06-16T20:00:00Z")),
    ).toBe(false);
  });
});
