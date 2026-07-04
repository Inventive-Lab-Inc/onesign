"use client";

import type { Device, WeeklySchedule } from "@signage/types";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConsoleCenterModal } from "@/components/devices/console-center-modal";
import { WeeklyScheduleFields } from "@/components/devices/weekly-schedule-fields";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createDefaultWeeklySchedule,
  normalizeWeeklySchedule,
  weeklySchedulesEqual,
} from "@/lib/weekly-schedule";
import { resolveDeviceScreenTimezone } from "@/lib/screen-timezone";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { cn } from "@/lib/utils";

export function DeviceOperatingHoursDialog({
  device,
  open,
  onClose,
  canEdit = true,
}: {
  device: Device;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
}) {
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();
  const patchDevice = useConsoleDataStore((s) => s.patchDevice);

  const [schedule, setSchedule] = useState<WeeklySchedule>(createDefaultWeeklySchedule());
  const [timezone, setTimezone] = useState("UTC");
  const [hoursMode, setHoursMode] = useState<"during" | "outside">("during");
  const [blankWhenOff, setBlankWhenOff] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSchedule(normalizeWeeklySchedule(device.operating_hours));
    setTimezone(resolveDeviceScreenTimezone(device));
    setHoursMode(device.operating_hours_inverted ? "outside" : "during");
    setBlankWhenOff(device.blank_when_off_hours ?? false);
  }, [open, device]);

  function reset() {
    setSchedule(createDefaultWeeklySchedule());
    setBlankWhenOff(false);
  }

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({
          operating_hours: schedule,
          operating_hours_timezone: timezone,
          operating_hours_inverted: hoursMode === "outside",
          blank_when_off_hours: blankWhenOff,
          operating_hours_timezone_auto: false,
        })
        .eq("id", device.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      patchDevice(device.id, {
        operating_hours: schedule,
        operating_hours_timezone: timezone,
        operating_hours_inverted: hoursMode === "outside",
        blank_when_off_hours: blankWhenOff,
        operating_hours_timezone_auto: false,
      });
      await syncNow();
      toast.success("Screen operating hours saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save operating hours");
    } finally {
      setSaving(false);
    }
  }

  const isDefault =
    !blankWhenOff && weeklySchedulesEqual(schedule, createDefaultWeeklySchedule());

  return (
    <ConsoleCenterModal
      open={open}
      onClose={onClose}
      title="Screen operating hours"
      icon={<Clock className="h-5 w-5" aria-hidden />}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={reset} disabled={!canEdit || saving || isDefault}>
            Reset
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!canEdit || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-foreground">This screen</span>
          <select
            value={hoursMode}
            disabled={!canEdit || saving}
            onChange={(event) => setHoursMode(event.target.value as "during" | "outside")}
            className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            aria-label="When this screen is in use"
          >
            <option value="during">is in use during these times:</option>
            <option value="outside">is in use outside of these times:</option>
          </select>
        </div>

        <WeeklyScheduleFields value={schedule} onChange={setSchedule} disabled={!canEdit || saving} />

        <p className="text-right text-xs text-muted-foreground">Screen timezone: {timezone}</p>

        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={blankWhenOff}
            disabled={!canEdit || saving}
            onChange={(event) => setBlankWhenOff(event.target.checked)}
            className="mt-0.5"
          />
          Blank the screen when not in use
        </label>
      </div>
    </ConsoleCenterModal>
  );
}

export function DeviceHoursButton({
  device,
  canEdit = true,
  compact = false,
  className,
  variant = "outline",
}: {
  device: Device;
  canEdit?: boolean;
  compact?: boolean;
  className?: string;
  variant?: "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip label="Operating hours">
        <Button
          type="button"
          variant={variant}
          size="sm"
          className={cn(compact ? "h-8 w-8 shrink-0 p-0" : "shrink-0 gap-1.5", className)}
          onClick={() => setOpen(true)}
          aria-label="Operating hours"
        >
          <Clock className="h-4 w-4" strokeWidth={2} aria-hidden />
          {compact ? null : "Hours"}
        </Button>
      </Tooltip>
      <DeviceOperatingHoursDialog device={device} open={open} onClose={() => setOpen(false)} canEdit={canEdit} />
    </>
  );
}
