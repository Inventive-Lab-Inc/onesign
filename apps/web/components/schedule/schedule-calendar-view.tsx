"use client";

import type { Device, Playlist, PlaylistItemWithMedia } from "@signage/types";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Monitor,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlaylistPreviewButton } from "@/components/playlist-preview";
import { Button } from "@/components/ui/button";
import {
  type CalendarViewMode,
  SCHEDULE_EVENT_COLORS,
  type ScheduleCalendarEvent,
  addDays,
  buildMonthGrid,
  dayKeyFromDate,
  expandPlaylistScheduleEvents,
  formatDayLabel,
  formatMonthLabel,
  formatWeekRangeLabel,
  groupEventsByDay,
  startOfLocalDay,
  startOfWeekSunday,
} from "@/lib/schedule-calendar";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function EventBlock({ event, compact = false }: { event: ScheduleCalendarEvent; compact?: boolean }) {
  const color = SCHEDULE_EVENT_COLORS[event.colorIndex] ?? SCHEDULE_EVENT_COLORS[0]!;
  return (
    <div
      className={cn(
        "truncate rounded-md border px-1.5 py-0.5 text-left leading-tight",
        compact ? "text-[0.625rem]" : "text-[0.6875rem]",
      )}
      style={{ backgroundColor: color.bg, color: color.text, borderColor: color.border }}
      title={`${event.startLabel} – ${event.endLabel} · ${event.label}`}
    >
      <span className="font-semibold tabular-nums">
        {event.startLabel} – {event.endLabel}
      </span>
      <span className="ml-1 font-medium">{event.label}</span>
    </div>
  );
}

export function ScheduleCalendarView({
  playlists,
  playlistItemsByPlaylistId,
  devices,
  screensPath = "/screens",
}: {
  playlists: Playlist[];
  playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
  devices: DeviceWithAssignments[];
  screensPath?: string;
}) {
  const sortedPlaylists = useMemo(
    () => [...playlists].sort((a, b) => a.name.localeCompare(b.name)),
    [playlists],
  );
  const [playlistId, setPlaylistId] = useState<string | null>(sortedPlaylists[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchor, setAnchor] = useState(() => startOfLocalDay(new Date()));

  useEffect(() => {
    if (!playlistId && sortedPlaylists[0]) {
      setPlaylistId(sortedPlaylists[0].id);
      return;
    }
    if (playlistId && !sortedPlaylists.some((playlist) => playlist.id === playlistId)) {
      setPlaylistId(sortedPlaylists[0]?.id ?? null);
    }
  }, [playlistId, sortedPlaylists]);

  const activePlaylist = sortedPlaylists.find((playlist) => playlist.id === playlistId) ?? null;
  const items = useMemo(
    () => (playlistId ? (playlistItemsByPlaylistId[playlistId] ?? []) : []),
    [playlistId, playlistItemsByPlaylistId],
  );

  const associatedDevices = useMemo(() => {
    if (!playlistId) return [] as Device[];
    return devices.filter((device) =>
      (device.device_playlists ?? []).some((row) => row.playlist_id === playlistId && row.is_active),
    );
  }, [devices, playlistId]);

  const range = useMemo(() => {
    if (viewMode === "day") {
      return { start: anchor, end: anchor };
    }
    if (viewMode === "week") {
      const start = startOfWeekSunday(anchor);
      return { start, end: addDays(start, 6) };
    }
    const grid = buildMonthGrid(anchor);
    return { start: grid[0]!, end: grid[grid.length - 1]! };
  }, [anchor, viewMode]);

  const eventsByDay = useMemo(() => {
    if (!playlistId) return {};
    return groupEventsByDay(
      expandPlaylistScheduleEvents({
        playlistId,
        items,
        rangeStart: range.start,
        rangeEnd: range.end,
      }),
    );
  }, [items, playlistId, range.end, range.start]);

  const monthGrid = useMemo(() => (viewMode === "month" ? buildMonthGrid(anchor) : []), [anchor, viewMode]);
  const weekDays = useMemo(() => {
    if (viewMode !== "week") return [];
    const start = startOfWeekSunday(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchor, viewMode]);

  const todayKey = dayKeyFromDate(new Date());
  const periodLabel =
    viewMode === "month"
      ? formatMonthLabel(anchor)
      : viewMode === "week"
        ? formatWeekRangeLabel(startOfWeekSunday(anchor))
        : formatDayLabel(anchor);

  function shiftPeriod(direction: -1 | 1) {
    if (viewMode === "month") {
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
      return;
    }
    if (viewMode === "week") {
      setAnchor(addDays(anchor, direction * 7));
      return;
    }
    setAnchor(addDays(anchor, direction));
  }

  function goToCurrent() {
    setAnchor(startOfLocalDay(new Date()));
  }

  if (sortedPlaylists.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-foreground">No playlists yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a playlist and add content to see it on the schedule calendar.
        </p>
        <Link
          href={screensPath}
          className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go to Screens
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="space-y-4 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Schedule name
            </p>
            <div className="flex items-center gap-2">
              <select
                className="h-9 max-w-full rounded-md border border-input bg-background px-2.5 text-sm font-semibold text-foreground"
                value={playlistId ?? ""}
                onChange={(event) => setPlaylistId(event.target.value || null)}
                aria-label="Select playlist schedule"
              >
                {sortedPlaylists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground" aria-hidden>
                <Pencil className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/30 p-1" role="tablist" aria-label="Calendar view">
            {(
              [
                { id: "day", label: "Daily" },
                { id: "week", label: "Week" },
                { id: "month", label: "Month" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={viewMode === tab.id}
                onClick={() => setViewMode(tab.id)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-semibold transition",
                  viewMode === tab.id
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => shiftPeriod(-1)} aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="inline-flex min-w-[7.5rem] items-center justify-center rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-strong">
              {periodLabel}
            </span>
            <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => shiftPeriod(1)} aria-label="Next period">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={goToCurrent}>
            {viewMode === "month" ? "Current Month" : viewMode === "week" ? "Current Week" : "Today"}
          </Button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {viewMode === "month" ? (
          <MonthGrid
            days={monthGrid}
            anchor={anchor}
            todayKey={todayKey}
            eventsByDay={eventsByDay}
          />
        ) : null}
        {viewMode === "week" ? (
          <WeekGrid days={weekDays} todayKey={todayKey} eventsByDay={eventsByDay} />
        ) : null}
        {viewMode === "day" ? (
          <DayList day={anchor} todayKey={todayKey} events={eventsByDay[dayKeyFromDate(anchor)] ?? []} />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
        <Link
          href={screensPath}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline"
        >
          <Monitor className="h-3.5 w-3.5" aria-hidden />
          Associated Displays ({associatedDevices.length})
        </Link>
        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <PlaylistPreviewButton items={items} playlistName={activePlaylist?.name ?? "Playlist"} />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              No items to preview
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  days,
  anchor,
  todayKey,
  eventsByDay,
}: {
  days: Date[];
  anchor: Date;
  todayKey: string;
  eventsByDay: Record<string, ScheduleCalendarEvent[]>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dayKeyFromDate(day);
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const events = eventsByDay[key] ?? [];
          const visible = events.slice(0, 3);
          const overflow = events.length - visible.length;
          return (
            <div
              key={key}
              className={cn(
                "min-h-[6.5rem] border-b border-r border-border/80 p-1.5 last:border-r-0",
                !inMonth && "bg-muted/20 text-muted-foreground",
                isToday && "bg-brand-soft/40",
              )}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                    isToday && "bg-[var(--theme)] text-[var(--theme-contrast)]",
                    !isToday && isWeekend(day) && inMonth && "text-red-600/80",
                    !isToday && !isWeekend(day) && inMonth && "text-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {visible.map((event) => (
                  <EventBlock key={event.id} event={event} compact />
                ))}
                {overflow > 0 ? (
                  <p className="px-1 text-[0.625rem] font-medium text-muted-foreground">+{overflow} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  todayKey,
  eventsByDay,
}: {
  days: Date[];
  todayKey: string;
  eventsByDay: Record<string, ScheduleCalendarEvent[]>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((day) => {
        const key = dayKeyFromDate(day);
        const isToday = key === todayKey;
        const events = eventsByDay[key] ?? [];
        return (
          <div
            key={key}
            className={cn(
              "min-h-[12rem] rounded-lg border border-border p-2",
              isToday && "border-brand bg-brand-soft/30",
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {WEEKDAY_HEADERS[day.getDay()]}
              </span>
              <span
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday ? "bg-[var(--theme)] text-[var(--theme-contrast)]" : "text-foreground",
                  !isToday && isWeekend(day) && "text-red-600/80",
                )}
              >
                {day.getDate()}
              </span>
            </div>
            <div className="space-y-1">
              {events.length === 0 ? (
                <p className="text-[0.6875rem] text-muted-foreground">No items</p>
              ) : (
                events.map((event) => <EventBlock key={event.id} event={event} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayList({
  day,
  todayKey,
  events,
}: {
  day: Date;
  todayKey: string;
  events: ScheduleCalendarEvent[];
}) {
  const key = dayKeyFromDate(day);
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-4",
        key === todayKey && "border-brand bg-brand-soft/20",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{formatDayLabel(day)}</h3>
        <span className="text-xs text-muted-foreground">
          {events.length} item{events.length === 1 ? "" : "s"}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled for this day.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventBlock event={event} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
