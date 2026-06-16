"use client";

import type { Website } from "@signage/types";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import type { AddWebsiteToPlaylistsOptions } from "@/lib/website-playlist-ops";
import { formatDeviceLastSeen } from "@/lib/device-status";
import {
  defaultDeviceScreenOrientationFilters,
  DEVICE_SCREEN_ORIENTATION_LABELS,
  DEVICE_SCREEN_ORIENTATIONS,
  formatDeviceScreenOrientationSubtitle,
  normalizeDeviceScreenOrientation,
} from "@/lib/device-screen-orientation";
import { DeviceScreenOrientationIcon } from "@/components/devices/device-screen-orientation-icon";
import { Filter, Globe, ListPlus, Tv, X } from "lucide-react";
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

export function AddWebsiteToScreensDialog({
  open,
  onClose,
  websiteItems,
  devices,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  websiteItems: Website[];
  devices: DeviceWithAssignments[];
  onConfirm: (deviceIds: string[], options: AddWebsiteToPlaylistsOptions) => Promise<void>;
}) {
  const titleId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState<AddWebsiteToPlaylistsOptions["position"]>("start");
  const [durationSeconds, setDurationSeconds] = useState("30");
  const [orientationFilters, setOrientationFilters] = useState(
    () => defaultDeviceScreenOrientationFilters(),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const filteredDevices = useMemo(() => {
    return devices.filter((device) =>
      orientationFilters.has(normalizeDeviceScreenOrientation(device.screen_orientation)),
    );
  }, [devices, orientationFilters]);

  const allFilteredSelected =
    filteredDevices.length > 0 && filteredDevices.every((device) => selected.has(device.id));

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setPosition("start");
    setDurationSeconds("30");
    setOrientationFilters(defaultDeviceScreenOrientationFilters());
    setFiltersOpen(false);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" aria-hidden />
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              Add to screens
            </h2>
          </div>
          <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {websiteItems.map((website) => (
              <span
                key={website.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
              >
                <Globe className="h-3.5 w-3.5" aria-hidden />
                {website.name}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Playlist position</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={position}
                onChange={(event) => setPosition(event.target.value as AddWebsiteToPlaylistsOptions["position"])}
              >
                <option value="start">Add to start</option>
                <option value="end">Add to end</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-duration">Duration (seconds)</Label>
              <Input
                id="website-duration"
                type="number"
                min={5}
                max={3600}
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Screens</p>
            <div ref={filtersRef} className="relative">
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setFiltersOpen((v) => !v)}>
                <Filter className="h-4 w-4" />
                Orientation
              </Button>
              {filtersOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card p-2 shadow-lg">
                  {DEVICE_SCREEN_ORIENTATIONS.map((orientation) => (
                    <label key={orientation} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={orientationFilters.has(orientation)}
                        onChange={() =>
                          setOrientationFilters((current) => {
                            const next = new Set(current);
                            if (next.has(orientation)) next.delete(orientation);
                            else next.add(orientation);
                            return next;
                          })
                        }
                      />
                      {DEVICE_SCREEN_ORIENTATION_LABELS[orientation]}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
            {filteredDevices.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No screens match the current filters.</p>
            ) : (
              filteredDevices.map((device) => {
                const checked = selected.has(device.id);
                const orientation = normalizeDeviceScreenOrientation(device.screen_orientation);
                return (
                  <label
                    key={device.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2",
                      checked ? "border-primary/40 bg-primary/5" : "border-border",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(device.id)) next.delete(device.id);
                          else next.add(device.id);
                          return next;
                        })
                      }
                    />
                    <DeviceScreenOrientationIcon orientation={orientation} className="h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{device.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDeviceScreenOrientationSubtitle(orientation)} • {formatScreenLastSeen(device.last_seen)}
                      </p>
                    </div>
                    <Tv className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (allFilteredSelected) {
                setSelected((current) => {
                  const next = new Set(current);
                  for (const device of filteredDevices) next.delete(device.id);
                  return next;
                });
              } else {
                setSelected((current) => {
                  const next = new Set(current);
                  for (const device of filteredDevices) next.add(device.id);
                  return next;
                });
              }
            }}
          >
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </Button>
          <Button
            type="button"
            disabled={adding || selected.size === 0}
            onClick={async () => {
              setAdding(true);
              try {
                const duration = Number(durationSeconds);
                await onConfirm([...selected], {
                  position,
                  durationSeconds: Number.isFinite(duration) ? duration : 30,
                });
                onClose();
              } finally {
                setAdding(false);
              }
            }}
          >
            {adding ? "Adding…" : `Add to ${selected.size} screen${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
