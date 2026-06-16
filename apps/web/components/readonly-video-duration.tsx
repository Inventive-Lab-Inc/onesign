"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { durationSecondsForStorage, probeVideoUrlDurationSeconds } from "@/lib/video-duration-probe";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ReadonlyVideoDurationProps {
  id: string;
  durationSeconds?: number | null;
  fallbackProbeUrl?: string | null;
  /** Called once when duration is read from the file (e.g. to persist on media). */
  onProbedDuration?: (seconds: number) => void;
  className?: string;
}

function secondsDisplay(duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) return "";
  return String(Math.max(1, Math.round(duration)));
}

export function ReadonlyVideoDuration({
  id,
  durationSeconds,
  fallbackProbeUrl,
  onProbedDuration,
  className,
}: ReadonlyVideoDurationProps) {
  const [probed, setProbed] = useState<number | null>(null);
  const [probing, setProbing] = useState(false);
  const reportedRef = useRef<number | null>(null);
  const hasDb =
    durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0;

  useEffect(() => {
    setProbed(null);
    setProbing(false);
    reportedRef.current = null;
  }, [durationSeconds, fallbackProbeUrl]);

  const isWebm = Boolean(fallbackProbeUrl?.toLowerCase().includes(".webm"));

  useEffect(() => {
    if ((hasDb && !isWebm) || !fallbackProbeUrl) return;

    let cancelled = false;
    setProbing(true);
    void probeVideoUrlDurationSeconds(fallbackProbeUrl).then((d) => {
      if (cancelled) return;
      setProbing(false);
      const stored = durationSecondsForStorage(d);
      if (stored == null) return;
      if (!hasDb || stored > Number(durationSeconds)) {
        setProbed(stored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [durationSeconds, fallbackProbeUrl, hasDb, isWebm]);

  useEffect(() => {
    if (probed == null || !onProbedDuration) return;
    const stored = durationSecondsForStorage(probed);
    if (stored == null) return;
    if (hasDb && stored <= Number(durationSeconds)) return;
    if (reportedRef.current === stored) return;
    reportedRef.current = stored;
    onProbedDuration(stored);
  }, [durationSeconds, hasDb, onProbedDuration, probed]);

  const sec =
    probed != null && (!hasDb || probed > Number(durationSeconds))
      ? probed
      : hasDb
        ? Number(durationSeconds)
        : probed;
  const valueText = sec != null && Number.isFinite(sec) && sec > 0 ? secondsDisplay(sec) : "";
  const placeholder = probing ? "Detecting…" : valueText ? "" : "—";

  return (
    <div className="min-w-0">
      <Label className="sr-only" htmlFor={id}>
        Video duration in seconds (from file, not editable)
      </Label>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={valueText}
        placeholder={placeholder}
        className={cn("h-9 w-full min-w-0 cursor-default text-sm tabular-nums", className)}
      />
    </div>
  );
}
