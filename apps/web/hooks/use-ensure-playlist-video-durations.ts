"use client";

import { ensureMediaVideoDuration } from "@/lib/media";
import type { PlaylistItemWithMedia } from "@signage/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo } from "react";

/** Probes and persists intrinsic length for playlist videos missing media.duration_seconds. */
export function useEnsurePlaylistVideoDurations(
  items: PlaylistItemWithMedia[],
  publicBaseUrl: string,
  supabase: SupabaseClient,
  onUpdated: () => void | Promise<void>,
) {
  const videoProbeKey = useMemo(
    () =>
      items
        .filter((i) => i.media.file_type === "video")
        .map((i) => `${i.media.id}:${i.media.duration_seconds ?? ""}`)
        .join("|"),
    [items],
  );

  useEffect(() => {
    if (!publicBaseUrl) return;

    const needsProbe = items.filter((i) => {
      if (i.media.file_type !== "video") return false;
      if (i.media.duration_seconds == null || i.media.duration_seconds <= 0) return true;
      return i.media.storage_path.toLowerCase().endsWith(".webm");
    });
    if (needsProbe.length === 0) return;

    let cancelled = false;
    void (async () => {
      let changed = false;
      for (const item of needsProbe) {
        const before = item.media.duration_seconds ?? null;
        const sec = await ensureMediaVideoDuration(supabase, item.media, publicBaseUrl);
        if (sec != null && sec !== before) changed = true;
      }
      if (changed && !cancelled) await onUpdated();
    })();

    return () => {
      cancelled = true;
    };
  }, [items, onUpdated, publicBaseUrl, supabase, videoProbeKey]);
}
