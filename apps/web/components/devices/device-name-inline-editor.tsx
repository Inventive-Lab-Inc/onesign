"use client";

import { Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { cn } from "@/lib/utils";

export function DeviceNameInlineEditor({
  deviceId,
  name: deviceName,
  canEdit = true,
  trailing,
  className,
}: {
  deviceId: string;
  name: string;
  canEdit?: boolean;
  trailing?: ReactNode;
  className?: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { syncNow } = useConsoleSync();
  const patchDevice = useConsoleDataStore((state) => state.patchDevice);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurSaveRef = useRef(false);

  const [draftName, setDraftName] = useState(deviceName);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftName(deviceName);
    }
  }, [deviceName, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const cancelEditing = useCallback(() => {
    skipBlurSaveRef.current = true;
    setDraftName(deviceName);
    setIsEditing(false);
  }, [deviceName]);

  const saveName = useCallback(async () => {
    if (!canEdit || !isEditing) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      toast.error("Enter a screen name.");
      setDraftName(deviceName);
      setIsEditing(false);
      return;
    }
    if (trimmed === deviceName.trim()) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("devices").update({ name: trimmed }).eq("id", deviceId);
      if (error) {
        toast.error(error.message);
        inputRef.current?.focus();
        return;
      }
      patchDevice(deviceId, { name: trimmed });
      await syncNow();
      toast.success("Screen name updated");
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save name");
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }, [canEdit, deviceId, deviceName, draftName, isEditing, patchDevice, supabase, syncNow]);

  const inputWidthCh = Math.max(draftName.length, deviceName.length, 3);

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      {isEditing ? (
        <input
          ref={inputRef}
          id={`device-name-${deviceId}`}
          type="text"
          value={draftName}
          disabled={saving}
          aria-label="Screen name"
          className="min-w-[3ch] max-w-full appearance-none border-0 border-b-2 border-foreground/35 bg-transparent px-0 pb-0.5 text-2xl font-semibold tracking-tight text-foreground shadow-none outline-none ring-0 transition-colors focus:border-foreground focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60"
          style={{ width: `${inputWidthCh}ch` }}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => {
            if (skipBlurSaveRef.current) {
              skipBlurSaveRef.current = false;
              return;
            }
            void saveName();
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
      ) : (
        <>
          <span className="break-words [overflow-wrap:anywhere]">{deviceName}</span>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="inline-flex h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setDraftName(deviceName);
                setIsEditing(true);
              }}
              aria-label="Edit screen name"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Button>
          ) : null}
        </>
      )}
      {trailing}
    </div>
  );
}
