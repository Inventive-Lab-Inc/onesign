"use client";

import type { Media } from "@signage/types";
import type { DeviceScreenOrientation } from "@signage/types";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import type { AddMediaPlaylistPosition, AddMediaToPlaylistsOptions } from "@/lib/media-playlist-ops";
import { formatDeviceLastSeen } from "@/lib/device-status";
import {
  defaultDeviceScreenOrientationFilters,
  DEVICE_SCREEN_ORIENTATION_LABELS,
  DEVICE_SCREEN_ORIENTATIONS,
  formatDeviceScreenOrientationSubtitle,
  normalizeDeviceScreenOrientation,
} from "@/lib/device-screen-orientation";
import { DeviceScreenOrientationIcon } from "@/components/devices/device-screen-orientation-icon";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { Filter, ListPlus, Tv, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatScreenLastSeen(iso: string | null): string {
  const label = formatDeviceLastSeen(iso);
  if (label === "Just now") return "Last seen a few seconds ago";
  if (label === "Never seen") return "Never seen";
  return `Last seen ${label.toLowerCase()}`;
}

export function AddMediaToScreensDialog({
  open,
  onClose,
  mediaItems,
  devices,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  mediaItems: Media[];
  devices: DeviceWithAssignments[];
  onConfirm: (deviceIds: string[], options: AddMediaToPlaylistsOptions) => Promise<void>;
}) {
  const titleId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState<AddMediaPlaylistPosition>("start");
  const [durationSeconds, setDurationSeconds] = useState("10");
  const [orientationFilters, setOrientationFilters] = useState<Set<DeviceScreenOrientation>>(
    () => defaultDeviceScreenOrientationFilters(),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const hasImageMedia = useMemo(() => mediaItems.some((item) => item.file_type === "image"), [mediaItems]);

  const filteredDevices = useMemo(() => {
    return devices.filter((device) =>
      orientationFilters.has(normalizeDeviceScreenOrientation(device.screen_orientation)),
    );
  }, [devices, orientationFilters]);

  const allFilteredSelected =
    filteredDevices.length > 0 && filteredDevices.every((device) => selected.has(device.id));

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setPosition("start");
      setDurationSeconds("10");
      setOrientationFilters(defaultDeviceScreenOrientationFilters());
      setFiltersOpen(false);
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!filtersOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (filtersRef.current?.contains(event.target as Node)) return;
      setFiltersOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [filtersOpen]);

  function toggleDevice(deviceId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        for (const device of filteredDevices) next.delete(device.id);
      } else {
        for (const device of filteredDevices) next.add(device.id);
      }
      return next;
    });
  }

  function toggleOrientationFilter(value: DeviceScreenOrientation) {
    setOrientationFilters((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        if (next.size === 1) return current;
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  async function handleApply() {
    if (selected.size === 0) return;
    const parsedDuration = Number.parseInt(durationSeconds, 10);
    const imageDurationSeconds =
      Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 10;

    setAdding(true);
    try {
      await onConfirm([...selected], { position, imageDurationSeconds });
      onClose();
    } finally {
      setAdding(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-softest text-primary">
              <ListPlus className="h-5 w-5" aria-hidden />
            </span>
            <h2 id={titleId} className="text-lg font-semibold leading-snug text-foreground">
              Add to the playlists of multiple screens
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-foreground p-1.5 text-background transition-opacity hover:opacity-90"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="grid gap-4 border-b border-border px-5 py-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-media-position">Add at position</Label>
            <select
              id="add-media-position"
              value={position}
              onChange={(event) => setPosition(event.target.value as AddMediaPlaylistPosition)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="start">Start of playlist</option>
              <option value="end">End of playlist</option>
            </select>
          </div>
          {hasImageMedia ? (
            <div className="space-y-1.5">
              <Label htmlFor="add-media-duration">Duration</Label>
              <div className="relative">
                <Input
                  id="add-media-duration"
                  inputMode="numeric"
                  value={durationSeconds}
                  onChange={(event) => setDurationSeconds(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="h-10 pr-16"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  Seconds
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          <div className="relative mb-3 flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
                disabled={filteredDevices.length === 0}
              />
              Select screens
            </label>
            <div ref={filtersRef} className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-expanded={filtersOpen}
              >
                <Filter className="h-3.5 w-3.5" aria-hidden />
                Filters
              </Button>
              {filtersOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
                  <p className="text-sm font-medium text-foreground">Screen orientation</p>
                  <div className="mt-2 overflow-hidden rounded-lg border border-border bg-brand-softest/40">
                    {DEVICE_SCREEN_ORIENTATIONS.map((orientation, index) => {
                      const active = orientationFilters.has(orientation);
                      return (
                        <button
                          key={orientation}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleOrientationFilter(orientation)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors",
                            index > 0 && "border-t border-border/70",
                            active
                              ? "bg-brand-softest text-primary"
                              : "text-primary/70 hover:bg-brand-softest/70 hover:text-primary",
                          )}
                        >
                          <DeviceScreenOrientationIcon orientation={orientation} className="h-4 w-4" />
                          {DEVICE_SCREEN_ORIENTATION_LABELS[orientation]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setOrientationFilters(defaultDeviceScreenOrientationFilters())}
                    >
                      Reset
                    </Button>
                    <Button type="button" size="sm" className="h-8" onClick={() => setFiltersOpen(false)}>
                      Apply
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No available screens found</p>
            ) : filteredDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No screens match the current filters.</p>
            ) : (
              <ul className="space-y-2">
                {filteredDevices.map((device) => {
                  const checked = selected.has(device.id);
                  const orientation = normalizeDeviceScreenOrientation(device.screen_orientation);
                  const thumbnailUrl = device.thumbnail_storage_path
                    ? mediaPublicUrl(device.thumbnail_storage_path)
                    : null;
                  return (
                    <li key={device.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                          checked ? "border-brand-faint30 bg-brand-softest" : "border-border hover:bg-muted/40",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-border"
                          checked={checked}
                          onChange={() => toggleDevice(device.id)}
                        />
                        <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded border border-border bg-muted">
                          {thumbnailUrl ? (
                            <Image src={thumbnailUrl} alt="" fill className="object-cover" sizes="64px" unoptimized />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                              <Tv className="h-4 w-4" aria-hidden />
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{device.name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{formatScreenLastSeen(device.last_seen)}</span>
                            <span aria-hidden>•</span>
                            <span className="inline-flex items-center gap-1">
                              <DeviceScreenOrientationIcon orientation={orientation} iconClassName="h-3 w-3" />
                              {formatDeviceScreenOrientationSubtitle(orientation)}
                            </span>
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <Button type="button" disabled={adding || selected.size === 0} onClick={() => void handleApply()}>
            {adding ? "Applying…" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
