"use client";

import type { Device } from "@signage/types";
import { X } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useConsoleDataStore } from "@/stores/console-data-store";

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function DeviceTagsEditor({
  device,
  canEdit = true,
  className,
}: {
  device: Device;
  canEdit?: boolean;
  className?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();
  const patchDevice = useConsoleDataStore((s) => s.patchDevice);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const tags = normalizeTags(device.tags ?? []);

  const persistTags = useCallback(
    async (nextTags: string[]) => {
      setSaving(true);
      try {
        const { error } = await supabase.from("devices").update({ tags: nextTags }).eq("id", device.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        patchDevice(device.id, { tags: nextTags });
        await syncNow();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to save tags");
      } finally {
        setSaving(false);
      }
    },
    [device.id, patchDevice, supabase, syncNow],
  );

  function addTag(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const next = normalizeTags([...tags, trimmed]);
    if (next.length === tags.length) {
      setDraft("");
      return;
    }
    setDraft("");
    void persistTags(next);
  }

  function removeTag(tag: string) {
    void persistTags(tags.filter((entry) => entry !== tag));
  }

  if (!canEdit && tags.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">Tags</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground"
          >
            {tag}
            {canEdit ? (
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Remove tag ${tag}`}
                disabled={saving}
                onClick={() => removeTag(tag)}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            ) : null}
          </span>
        ))}
        {canEdit ? (
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag(draft);
              }
            }}
            onBlur={() => {
              if (draft.trim()) addTag(draft);
            }}
            placeholder={tags.length === 0 ? "Type and press Enter" : "Add tag…"}
            disabled={saving}
            className="h-8 min-w-[8rem] max-w-xs flex-1 text-xs"
            aria-label="Add screen tag"
          />
        ) : null}
      </div>
    </div>
  );
}
