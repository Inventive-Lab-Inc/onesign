"use client";

import type { Device } from "@signage/types";
import { Tv } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { isDevicePausedByQuota } from "@/components/device-disabled-notice";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";

export function DevicePlaybackToggle({ device }: { device: Device }) {
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();
  const patchDevice = useConsoleDataStore((s) => s.patchDevice);
  const adminStaff = useOptionalAdminStaff();
  const [busy, setBusy] = useState(false);
  const disabled = Boolean(device.playback_disabled);
  const quotaPaused = isDevicePausedByQuota(device);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      const next = !disabled;
      const { error } = await supabase
        .from("devices")
        .update({ playback_disabled: next, paused_by_quota: false })
        .eq("id", device.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      patchDevice(device.id, { playback_disabled: next, paused_by_quota: false });
      toast.success(next ? "Device disabled" : "Device enabled");
      await syncNow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update screen");
    } finally {
      setBusy(false);
    }
  }, [device.id, disabled, patchDevice, supabase, syncNow]);

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
      variant={disabled ? "default" : "outline"}
      size="sm"
      className="gap-2"
      disabled={busy}
      title={disabled ? "Turn this device back on" : "Disable this device"}
      onClick={() => void toggle()}
    >
      <Tv className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      {busy ? "Updating…" : disabled ? "Enable Device" : "Disable Device"}
    </Button>
  );
}
