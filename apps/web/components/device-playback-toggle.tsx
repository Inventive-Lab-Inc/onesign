"use client";

import type { Device } from "@signage/types";
import { Loader2, Power, Tv } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { isDevicePausedByQuota } from "@/components/device-disabled-notice";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { cn } from "@/lib/utils";

function useDevicePlaybackToggle(device: Device) {
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();
  const patchDevice = useConsoleDataStore((s) => s.patchDevice);
  const [busy, setBusy] = useState(false);
  const playbackOff = Boolean(device.playback_disabled) || isDevicePausedByQuota(device);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      const next = !playbackOff;
      const { error } = await supabase
        .from("devices")
        .update({ playback_disabled: next, paused_by_quota: false })
        .eq("id", device.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      patchDevice(device.id, { playback_disabled: next, paused_by_quota: false });
      toast.success(next ? "Screen disabled" : "Screen enabled");
      await syncNow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update screen");
    } finally {
      setBusy(false);
    }
  }, [device.id, patchDevice, playbackOff, supabase, syncNow]);

  return { busy, playbackOff, toggle };
}

export function DevicePlaybackPowerButton({
  device,
  className,
  variant = "secondary",
  onPointerDown,
}: {
  device: Device;
  className?: string;
  variant?: "secondary" | "outline";
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const adminStaff = useOptionalAdminStaff();
  const { busy, playbackOff, toggle } = useDevicePlaybackToggle(device);
  const label = playbackOff ? `Enable ${device.name}` : `Disable ${device.name}`;

  if (!adminStaff?.canWrite) {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={busy}
      title={label}
      aria-label={label}
      className={cn(
        "h-8 w-8 p-0 transition-all duration-150 hover:shadow-sm active:scale-[0.97]",
        "hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300",
        className,
      )}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle();
      }}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Power className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      )}
    </Button>
  );
}

export function DevicePlaybackToggle({ device }: { device: Device }) {
  const adminStaff = useOptionalAdminStaff();
  const { busy, playbackOff, toggle } = useDevicePlaybackToggle(device);
  const quotaPaused = isDevicePausedByQuota(device);

  if (quotaPaused && !adminStaff?.canWrite) {
    return (
      <p className="text-xs text-muted-foreground">
        Paused by plan limit — contact your administrator.
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant={playbackOff ? "default" : "outline"}
      size="sm"
      className="gap-2"
      disabled={busy}
      title={playbackOff ? "Turn this device back on" : "Disable this device"}
      onClick={() => void toggle()}
    >
      <Tv className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      {busy ? "Updating…" : playbackOff ? "Enable Device" : "Disable Device"}
    </Button>
  );
}
