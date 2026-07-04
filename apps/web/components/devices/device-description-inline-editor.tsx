"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { cn } from "@/lib/utils";

export function DeviceDescriptionInlineEditor({
  deviceId,
  description: deviceDescription,
  canEdit = true,
  inline = false,
  className,
}: {
  deviceId: string;
  description?: string | null;
  canEdit?: boolean;
  /** Flow with sibling meta text instead of occupying a dedicated block row. */
  inline?: boolean;
  className?: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { syncNow } = useConsoleSync();
  const patchDevice = useConsoleDataStore((state) => state.patchDevice);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurSaveRef = useRef(false);

  const storedDescription = deviceDescription?.trim() ?? "";
  const [draftDescription, setDraftDescription] = useState(storedDescription);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftDescription(storedDescription);
    }
  }, [storedDescription, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const cancelEditing = useCallback(() => {
    skipBlurSaveRef.current = true;
    setDraftDescription(storedDescription);
    setIsEditing(false);
  }, [storedDescription]);

  const startEditing = useCallback(() => {
    if (!canEdit) return;
    setDraftDescription(storedDescription);
    setIsEditing(true);
  }, [canEdit, storedDescription]);

  const saveDescription = useCallback(async () => {
    if (!canEdit || !isEditing) return;
    const trimmed = draftDescription.trim();
    if (trimmed === storedDescription) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({ description: trimmed || null })
        .eq("id", deviceId);
      if (error) {
        toast.error(error.message);
        inputRef.current?.focus();
        return;
      }
      patchDevice(deviceId, { description: trimmed || null });
      await syncNow();
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save description");
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }, [canEdit, deviceId, draftDescription, isEditing, patchDevice, storedDescription, supabase, syncNow]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        id={`device-description-${deviceId}`}
        type="text"
        value={draftDescription}
        disabled={saving}
        aria-label="Screen description"
        placeholder="Optional subtitle"
        className={cn(
          "min-w-[10ch] w-full max-w-xl appearance-none border-0 border-b border-muted-foreground/35 bg-transparent px-0 pb-0.5 text-xs text-muted-foreground shadow-none outline-none ring-0 transition-colors placeholder:text-muted-foreground/50 focus:border-muted-foreground/70 focus:text-foreground/80 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60",
          className,
        )}
        onChange={(event) => setDraftDescription(event.target.value)}
        onBlur={() => {
          if (skipBlurSaveRef.current) {
            skipBlurSaveRef.current = false;
            return;
          }
          void saveDescription();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelEditing();
          }
        }}
      />
    );
  }

  if (!storedDescription && !canEdit) {
    return null;
  }

  if (!storedDescription) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className={cn(
          inline
            ? "shrink-0 text-xs italic text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            : "max-w-xl text-left text-xs italic text-muted-foreground/60 transition-colors hover:text-muted-foreground",
          className,
        )}
      >
        Add description
      </button>
    );
  }

  if (!canEdit) {
    return (
      <p className={cn(inline ? "truncate" : "max-w-xl text-xs text-muted-foreground", className)}>
        {storedDescription}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(
        inline
          ? "max-w-[min(100%,20rem)] truncate text-left text-xs text-muted-foreground transition-colors hover:text-foreground/75"
          : "max-w-xl text-left text-xs text-muted-foreground transition-colors hover:text-foreground/75",
        className,
      )}
    >
      {storedDescription}
    </button>
  );
}
