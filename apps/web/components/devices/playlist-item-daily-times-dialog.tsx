"use client";

import type { PlaylistItemWithMedia, WeeklySchedule } from "@signage/types";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConsoleCenterModal } from "@/components/devices/console-center-modal";
import { WeeklyScheduleFields } from "@/components/devices/weekly-schedule-fields";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createDefaultWeeklySchedule,
  normalizeWeeklySchedule,
  resolveScreenTimezone,
} from "@/lib/weekly-schedule";

export function PlaylistItemDailyTimesDialog({
  open,
  onClose,
  item,
  screenTimezone,
  onSaved,
  draftOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  item: PlaylistItemWithMedia | null;
  screenTimezone?: string | null;
  onSaved: (patch: Pick<PlaylistItemWithMedia, "daily_schedule_enabled" | "daily_schedule">) => void;
  draftOnly?: boolean;
}) {
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();
  const timezone = resolveScreenTimezone(screenTimezone);

  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule>(createDefaultWeeklySchedule());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setEnabled(item.daily_schedule_enabled ?? false);
    setSchedule(normalizeWeeklySchedule(item.daily_schedule ?? undefined));
  }, [open, item]);

  async function save() {
    if (!item) return;
    setSaving(true);
    try {
      const payload = {
        daily_schedule_enabled: enabled,
        daily_schedule: enabled ? schedule : null,
      };
      if (!draftOnly) {
        const { error } = await supabase.from("playlist_items").update(payload).eq("id", item.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        await syncNow();
      }
      onSaved(payload);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save daily display times");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setEnabled(false);
    setSchedule(createDefaultWeeklySchedule());
  }

  if (!item) return null;

  return (
    <ConsoleCenterModal
      open={open}
      onClose={onClose}
      title="Daily display times"
      icon={<Clock className="h-5 w-5" aria-hidden />}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={reset} disabled={saving}>
            Reset
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "OK"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(event) => setEnabled(event.target.checked)}
            className="mt-0.5"
          />
          Only display this item between the following times:
        </label>

        <WeeklyScheduleFields
          value={schedule}
          onChange={setSchedule}
          disabled={!enabled || saving}
        />

        <p className="text-right text-xs text-muted-foreground">Screen timezone: {timezone}</p>
      </div>
    </ConsoleCenterModal>
  );
}
