import type { Device } from "@signage/types";
import { effectiveDeviceStatus } from "@/lib/device-status";

export type DeviceConnectionState = "connected" | "unreachable" | "never_connected";

export function getDeviceConnectionState(
  device: Pick<Device, "status" | "last_seen">,
): DeviceConnectionState {
  if (effectiveDeviceStatus(device) === "online") return "connected";
  if (!device.last_seen) return "never_connected";
  return "unreachable";
}

export function deviceConnectionLabel(state: DeviceConnectionState): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "never_connected":
      return "Not connected";
    case "unreachable":
      return "Offline";
  }
}

export function deviceConnectionHint(
  state: DeviceConnectionState,
  device: Pick<Device, "last_seen" | "platform">,
): string | null {
  switch (state) {
    case "connected":
      return null;
    case "never_connected":
    case "unreachable":
      return "Is your screen showing a pairing code?";
  }
}
