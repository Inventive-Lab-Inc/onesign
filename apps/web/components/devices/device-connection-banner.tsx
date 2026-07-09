"use client";

import type { Device } from "@signage/types";
import { AlertTriangle, Link2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { deviceConnectionHint, getDeviceConnectionState } from "@/lib/device-connection";

export function DeviceConnectionBanner({
  device,
  onReconnect,
}: {
  device: Pick<Device, "status" | "last_seen" | "platform">;
  onReconnect?: () => void;
}) {
  const state = useMemo(() => getDeviceConnectionState(device), [device]);
  const message = deviceConnectionHint(state, device);

  if (state === "connected" || !message) return null;

  return (
    <div
      role="status"
      className="border-t border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 sm:px-5 dark:text-amber-100"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200" aria-hidden />
          <p className="font-medium text-foreground">{message}</p>
        </div>

        {onReconnect ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 border-amber-600/25 bg-card/80 hover:bg-card"
            onClick={onReconnect}
          >
            <Link2 className="h-4 w-4" aria-hidden />
            Reconnect player
          </Button>
        ) : null}
      </div>
    </div>
  );
}
