"use client";

import { Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaDateFilter, MediaOrientationFilter, MediaTypeFilter } from "@/lib/media-display";

export type MediaFiltersState = {
  typeFilter: MediaTypeFilter;
  orientationFilter: MediaOrientationFilter;
  dateFilter: MediaDateFilter;
};

type MediaFiltersPopoverProps = {
  value: MediaFiltersState;
  onApply: (next: MediaFiltersState) => void;
};

const DATE_OPTIONS: { id: MediaDateFilter; label: string }[] = [
  { id: "all", label: "Any time" },
  { id: "week", label: "Past week" },
  { id: "month", label: "Past month" },
  { id: "year", label: "Past year" },
];

const TYPE_OPTIONS: { id: Exclude<MediaTypeFilter, "all" | "unknown">; label: string }[] = [
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
];

const ORIENTATION_OPTIONS: { id: Exclude<MediaOrientationFilter, "all">; label: string }[] = [
  { id: "landscape", label: "Landscape" },
  { id: "portrait", label: "Portrait" },
];

export function MediaFiltersPopover({ value, onApply }: MediaFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MediaFiltersState>(value);
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

  const typeActive = draft.typeFilter !== "all" && draft.typeFilter !== "unknown";
  const orientationActive = draft.orientationFilter !== "all";
  const dateActive = draft.dateFilter !== "all";
  const isActive = typeActive || orientationActive || dateActive;

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
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-4 shadow-lg">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploaded</p>
              <select
                value={draft.dateFilter}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dateFilter: event.target.value as MediaDateFilter }))
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Media type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((option) => {
                  const selected = draft.typeFilter === option.id;
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
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          typeFilter: selected ? "all" : option.id,
                        }))
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orientation</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ORIENTATION_OPTIONS.map((option) => {
                  const selected = draft.orientationFilter === option.id;
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
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          orientationFilter: selected ? "all" : option.id,
                        }))
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const reset: MediaFiltersState = {
                  typeFilter: "all",
                  orientationFilter: "all",
                  dateFilter: "all",
                };
                setDraft(reset);
                onApply(reset);
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
