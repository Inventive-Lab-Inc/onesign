"use client";

import type { PlaylistTransitionStyle } from "@signage/types";
import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TRANSITION_OPTIONS: { id: PlaylistTransitionStyle; label: string; hint: string }[] = [
  { id: "none", label: "None", hint: "Cut directly to the next item" },
  { id: "fade", label: "Fade", hint: "Short fade between items" },
  { id: "dissolve", label: "Dissolve", hint: "Crossfade between items" },
];

export function PlaylistTransitionsDialog({
  open,
  onClose,
  transitionStyle,
  shuffleEnabled,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  transitionStyle: PlaylistTransitionStyle;
  shuffleEnabled: boolean;
  onSave: (values: { transitionStyle: PlaylistTransitionStyle; shuffleEnabled: boolean }) => Promise<void>;
}) {
  const titleId = useId();
  const descId = useId();
  const [style, setStyle] = useState(transitionStyle);
  const [shuffle, setShuffle] = useState(shuffleEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStyle(transitionStyle);
    setShuffle(shuffleEnabled);
  }, [open, transitionStyle, shuffleEnabled]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ transitionStyle: style, shuffleEnabled: shuffle });
      onClose();
    } finally {
      setSaving(false);
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
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              Playlist transitions
            </h2>
            <p id={descId} className="mt-1 text-sm text-muted-foreground">
              Choose how this screen moves between items during playback.
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

        <div className="mt-5 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transition</Label>
          <ul className="space-y-1.5">
            {TRANSITION_OPTIONS.map((option) => {
              const selected = style === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => setStyle(option.id)}
                    className={cn(
                      "flex w-full flex-col rounded-lg border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-brand-faint30 bg-brand-softest"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5 rounded-lg border border-border px-3 py-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={shuffle}
              onChange={(event) => setShuffle(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Shuffle play</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Randomize item order on the TV each time the playlist loads.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
