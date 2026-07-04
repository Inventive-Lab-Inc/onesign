"use client";

import type { Device } from "@signage/types";
import { RotateCwSquare } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DEVICE_SCREEN_ORIENTATION_LABELS,
  nextDeviceScreenOrientation,
  normalizeDeviceScreenOrientation,
} from "@/lib/device-screen-orientation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { cn } from "@/lib/utils";

export function DeviceOrientationRotateButton({
  device,
  canEdit = true,
  compact = false,
  className,
}: {
  device: Device;
  canEdit?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();
  const patchDevice = useConsoleDataStore((state) => state.patchDevice);
  const [saving, setSaving] = useState(false);

  const orientation = normalizeDeviceScreenOrientation(device.screen_orientation);
  const nextOrientation = nextDeviceScreenOrientation(orientation);

  const rotate = useCallback(async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({ screen_orientation: nextOrientation })
        .eq("id", device.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      patchDevice(device.id, { screen_orientation: nextOrientation });
      await syncNow();
      toast.success(`Screen set to ${DEVICE_SCREEN_ORIENTATION_LABELS[nextOrientation]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to rotate screen");
    } finally {
      setSaving(false);
    }
  }, [canEdit, device.id, nextOrientation, patchDevice, saving, supabase, syncNow]);

  if (!canEdit) return null;

  const rotateLabel = `Rotate to ${DEVICE_SCREEN_ORIENTATION_LABELS[nextOrientation]}`;

  return (
    <Tooltip label={rotateLabel}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(compact ? "h-8 w-8 shrink-0 p-0" : "shrink-0 gap-1.5", className)}
        disabled={saving}
        onClick={() => void rotate()}
        aria-label={`Rotate screen. Current: ${DEVICE_SCREEN_ORIENTATION_LABELS[orientation]}. Next: ${DEVICE_SCREEN_ORIENTATION_LABELS[nextOrientation]}.`}
      >
        <RotateCwSquare className={cn("h-4 w-4", saving && "opacity-60")} aria-hidden />
        {compact ? null : "Rotate"}
      </Button>
    </Tooltip>
  );
}
