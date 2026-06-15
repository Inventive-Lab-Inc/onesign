"use client";

import type { Device, DeviceScreenOrientation } from "@signage/types";
import { Settings2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import {
  DEVICE_SCREEN_ORIENTATION_LABELS,
  DEVICE_SCREEN_ORIENTATIONS,
  normalizeDeviceScreenOrientation,
} from "@/lib/device-screen-orientation";
import { DeviceScreenOrientationIcon } from "@/components/devices/device-screen-orientation-icon";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function DeviceScreenOrientationSettings({ device }: { device: Device }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const { syncNow } = useConsoleSync();
  const supabase = getSupabaseBrowserClient();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function save(next: DeviceScreenOrientation) {
    setSaving(true);
    try {
      const { error } = await supabase.from("devices").update({ screen_orientation: next }).eq("id", device.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Orientation set to ${DEVICE_SCREEN_ORIENTATION_LABELS[next]}`);
      await syncNow();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save orientation");
    } finally {
      setSaving(false);
    }
  }

  const current = normalizeDeviceScreenOrientation(device.screen_orientation);

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden />
        Screen settings
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-muted/30 px-5 py-4">
              <h2 id={titleId} className="text-lg font-semibold text-foreground">
                Screen orientation
              </h2>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Choose how this TV locks orientation during playback. The device applies the change within a few seconds after you save.
              </p>
              <div className="overflow-hidden rounded-lg border border-border bg-brand-softest/40">
                {DEVICE_SCREEN_ORIENTATIONS.map((orientation, index) => {
                  const selected = current === orientation;
                  return (
                    <button
                      key={orientation}
                      type="button"
                      disabled={saving}
                      onClick={() => void save(orientation)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors",
                        index > 0 && "border-t border-border/70",
                        selected
                          ? "bg-brand-softest text-primary"
                          : "text-primary hover:bg-brand-softest/70",
                      )}
                    >
                      <DeviceScreenOrientationIcon orientation={orientation} className="h-4 w-4" />
                      {DEVICE_SCREEN_ORIENTATION_LABELS[orientation]}
                    </button>
                  );
                })}
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                Current on device:{" "}
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <DeviceScreenOrientationIcon orientation={current} className="h-3.5 w-3.5" iconClassName="h-3 w-3" />
                  {DEVICE_SCREEN_ORIENTATION_LABELS[current]}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
