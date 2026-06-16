"use client";

import type { PlaylistItemWithMedia } from "@signage/types";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConsoleCenterModal } from "@/components/devices/console-center-modal";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/media-information";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function PlaylistItemPeriodicDialog({
  open,
  onClose,
  item,
  onSaved,
  draftOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  item: PlaylistItemWithMedia | null;
  onSaved: (patch: Pick<PlaylistItemWithMedia, "display_from" | "display_until">) => void;
  draftOnly?: boolean;
}) {
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();

  const [displayFrom, setDisplayFrom] = useState("");
  const [displayUntil, setDisplayUntil] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setDisplayFrom(toDatetimeLocalValue(item.display_from));
    setDisplayUntil(toDatetimeLocalValue(item.display_until));
  }, [open, item]);

  async function save() {
    if (!item) return;
    setSaving(true);
    try {
      const payload = {
        display_from: fromDatetimeLocalValue(displayFrom),
        display_until: fromDatetimeLocalValue(displayUntil),
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
      toast.error(err instanceof Error ? err.message : "Unable to save schedule");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDisplayFrom("");
    setDisplayUntil("");
  }

  if (!item) return null;

  return (
    <ConsoleCenterModal
      open={open}
      onClose={onClose}
      title="Schedule periodic display"
      icon={<CalendarClock className="h-5 w-5" aria-hidden />}
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
        <p className="text-sm text-muted-foreground">
          Show this playlist item only between the start and expiry dates below. Leave blank to always show when the screen is active.
        </p>
        <div className="space-y-2">
          <Label htmlFor="periodic-start">Start date &amp; time</Label>
          <Input
            id="periodic-start"
            type="datetime-local"
            value={displayFrom}
            disabled={saving}
            onChange={(event) => setDisplayFrom(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodic-expiry">Expiry date &amp; time</Label>
          <Input
            id="periodic-expiry"
            type="datetime-local"
            value={displayUntil}
            disabled={saving}
            onChange={(event) => setDisplayUntil(event.target.value)}
          />
        </div>
      </div>
    </ConsoleCenterModal>
  );
}
