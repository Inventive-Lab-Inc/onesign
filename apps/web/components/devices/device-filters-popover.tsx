"use client";

import type { DeviceScreenOrientation, DeviceStatus } from "@signage/types";
import { Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEVICE_SCREEN_ORIENTATION_LABELS,
  DEVICE_SCREEN_ORIENTATIONS,
} from "@/lib/device-screen-orientation";
import {
  DEFAULT_DEVICE_FILTERS,
  deviceFiltersAreActive,
  type DeviceDateFilter,
  type DeviceFiltersState,
} from "@/lib/device-display";
import { cn } from "@/lib/utils";

type DeviceFiltersPopoverProps = {
  value: DeviceFiltersState;
  onApply: (next: DeviceFiltersState) => void;
  knownTags?: string[];
};

const DATE_OPTIONS: { id: DeviceDateFilter; label: string }[] = [
  { id: "all", label: "Any time" },
  { id: "week", label: "Past week" },
  { id: "month", label: "Past month" },
  { id: "year", label: "Past year" },
];

const STATUS_OPTIONS: { id: DeviceStatus; label: string }[] = [
  { id: "online", label: "Online" },
  { id: "offline", label: "Offline" },
  { id: "pending_pairing", label: "Pending" },
];

export function DeviceFiltersPopover({ value, onApply, knownTags = [] }: DeviceFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DeviceFiltersState>(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isActive = deviceFiltersAreActive(value);

  function toggleStatus(status: DeviceStatus) {
    setDraft((current) => {
      const selected = current.statusFilters.includes(status);
      const statusFilters = selected
        ? current.statusFilters.filter((entry) => entry !== status)
        : [...current.statusFilters, status];
      return { ...current, statusFilters };
    });
  }

  function toggleOrientation(orientation: DeviceScreenOrientation) {
    setDraft((current) => ({
      ...current,
      orientationFilter: current.orientationFilter === orientation ? "all" : orientation,
    }));
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-9 gap-1.5", isActive && "border-primary/40 bg-brand-softest/40")}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <Filter className="h-4 w-4" aria-hidden />
        Filters
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-4 shadow-lg">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date added</p>
              <select
                value={draft.dateFilter}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dateFilter: event.target.value as DeviceDateFilter }))
                }
                className="mt-2 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {DATE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Screen orientation
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {DEVICE_SCREEN_ORIENTATIONS.map((orientation) => {
                  const selected = draft.orientationFilter === orientation;
                  return (
                    <button
                      key={orientation}
                      type="button"
                      className={cn(
                        "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-brand-softest text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                      onClick={() => toggleOrientation(orientation)}
                    >
                      {DEVICE_SCREEN_ORIENTATION_LABELS[orientation]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => {
                  const selected = draft.statusFilters.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm transition-colors",
                        selected
                          ? "border-primary bg-brand-softest text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                      onClick={() => toggleStatus(option.id)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
              <Input
                value={draft.tagFilter}
                onChange={(event) => setDraft((current) => ({ ...current, tagFilter: event.target.value }))}
                placeholder="Type to filter by tag"
                className="mt-2 h-9 text-sm"
                list={knownTags.length > 0 ? "device-tag-suggestions" : undefined}
              />
              {knownTags.length > 0 ? (
                <datalist id="device-tag-suggestions">
                  {knownTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(DEFAULT_DEVICE_FILTERS);
                onApply(DEFAULT_DEVICE_FILTERS);
                setOpen(false);
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
