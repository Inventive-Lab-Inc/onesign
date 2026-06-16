"use client";

import type { DeviceWithAssignments } from "@/lib/console-sync";
import { useConsoleDataStore } from "@/stores/console-data-store";

/** Subscribe to a single device row without unstable selector fallbacks. */
export function useConsoleDevice(deviceId: string): DeviceWithAssignments | undefined {
  return useConsoleDataStore((s) => s.devices.find((device) => device.id === deviceId));
}
