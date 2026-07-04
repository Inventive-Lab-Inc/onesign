"use client";

import type { Device } from "@signage/types";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
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
  const patchDevice = useConsoleDataStore((state) => state.patchDevice);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurSaveRef = useRef(false);

  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const tags = normalizeTags(device.tags ?? []);

  useEffect(() => {
    if (!adding) return;
    inputRef.current?.focus();
  }, [adding]);

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

  function closeAdding() {
    skipBlurSaveRef.current = true;
    setDraft("");
    setAdding(false);
  }

  function addTag(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      closeAdding();
      return;
    }
    const next = normalizeTags([...tags, trimmed]);
    if (next.length === tags.length) {
      closeAdding();
      return;
    }
    setDraft("");
    setAdding(false);
    void persistTags(next);
  }

  function removeTag(tag: string) {
    void persistTags(tags.filter((entry) => entry !== tag));
  }

  if (!canEdit && tags.length === 0) {
    return null;
  }

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          role="listitem"
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-muted/35 px-2.5 py-0.5 text-[0.6875rem] leading-tight font-medium text-foreground"
        >
          <span className="min-w-0 truncate">{tag}</span>
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
        adding ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            disabled={saving}
            aria-label="Add screen tag"
            placeholder="Tag name"
            className="h-6 w-24 rounded-full border border-border bg-background px-2.5 text-[0.6875rem] outline-none ring-0 focus-visible:border-foreground/40 focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (skipBlurSaveRef.current) {
                skipBlurSaveRef.current = false;
                return;
              }
              addTag(draft);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeAdding();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/80 px-2.5 py-0.5 text-[0.6875rem] leading-tight font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground disabled:opacity-60"
            aria-label="Add tag"
            disabled={saving}
            onClick={() => {
              setDraft("");
              setAdding(true);
            }}
          >
            <Plus className="h-3 w-3 shrink-0" aria-hidden />
            Add tag
          </button>
        )
      ) : null}
    </div>
  );
}
