"use client";

import type { WeeklySchedule, WeekdayKey } from "@signage/types";
import { Input } from "@/components/ui/input";
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/weekly-schedule";

export function WeeklyScheduleFields({
  value,
  onChange,
  disabled = false,
  startLabel = "Start",
  endLabel = "End",
}: {
  value: WeeklySchedule;
  onChange: (next: WeeklySchedule) => void;
  disabled?: boolean;
  startLabel?: string;
  endLabel?: string;
}) {
  function updateDay(day: WeekdayKey, field: "start" | "end", nextValue: string) {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        [field]: nextValue,
      },
    });
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[72px_1fr_1fr] items-center gap-2 px-0.5">
        <span />
        <span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">{startLabel}</span>
        <span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">{endLabel}</span>
      </div>
      {WEEKDAY_KEYS.map((day) => (
        <div key={day} className="grid grid-cols-[72px_1fr_1fr] items-center gap-2">
          <span className="text-sm font-medium text-foreground">{WEEKDAY_LABELS[day]}</span>
          <Input
            type="time"
            value={value[day].start}
            disabled={disabled}
            onChange={(event) => updateDay(day, "start", event.target.value)}
            className="h-8"
          />
          <Input
            type="time"
            value={value[day].end}
            disabled={disabled}
            onChange={(event) => updateDay(day, "end", event.target.value)}
            className="h-8"
          />
        </div>
      ))}
    </div>
  );
}
