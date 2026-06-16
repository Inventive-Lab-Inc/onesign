"use client";

import type { DeviceWithAssignments } from "@/lib/console-sync";
import { X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyPlaylistToScreensDialog({
  open,
  onClose,
  sourceDeviceName,
  devices,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  sourceDeviceName: string;
  devices: DeviceWithAssignments[];
  onConfirm: (targetDeviceIds: string[]) => Promise<void>;
}) {
  const titleId = useId();
  const descId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);

  const targets = useMemo(() => devices, [devices]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function toggleDevice(deviceId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }

  async function handleCopy() {
    if (selected.size === 0) return;
    setCopying(true);
    try {
      await onConfirm([...selected]);
      onClose();
    } finally {
      setCopying(false);
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
        aria-describedby={descId}
        className="relative z-10 flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              Copy playlist to other screens
            </h2>
            <p id={descId} className="mt-1 text-sm text-muted-foreground">
              Replace the playlist on selected screens with the content from{" "}
              <span className="font-medium text-foreground">{sourceDeviceName}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other screens are linked to your account.</p>
          ) : (
            <ul className="space-y-2">
              {targets.map((device) => {
                const checked = selected.has(device.id);
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
                        className="h-4 w-4 rounded border-border"
                        checked={checked}
                        onChange={() => toggleDevice(device.id)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{device.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={copying}>
            Cancel
          </Button>
          <Button type="button" disabled={copying || selected.size === 0} onClick={() => void handleCopy()}>
            {copying ? "Copying…" : `Copy to ${selected.size} screen${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
