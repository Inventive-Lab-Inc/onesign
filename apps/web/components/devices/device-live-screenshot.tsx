"use client";

import type { Device } from "@signage/types";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getDeviceDisplayDimensionsPx } from "@/components/device-telemetry-panel";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import { effectiveDeviceStatus } from "@/lib/device-status";
import { applyDevicePresenceRows, fetchDevicePresence } from "@/lib/device-presence";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import {
  normalizeDeviceScreenOrientation,
  resolvePreviewFrameDimensions,
} from "@/lib/device-screen-orientation";
import {
  deviceLiveScreenshotObjectPath,
  requestDeviceLiveScreenshot,
} from "@/lib/upload-device-live-screenshot";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDevice } from "@/hooks/use-console-device";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 90_000;
const OFFLINE_CAPTURE_MESSAGE = "The screen must be online to capture a live screenshot.";

function formatCaptureTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${date}, ${time}`;
}

function DeviceOrientedScreenshot({
  device,
  src,
  alt,
}: {
  device: Device;
  src: string;
  alt: string;
}) {
  const orientation = normalizeDeviceScreenOrientation(device.screen_orientation);
  const frame = resolvePreviewFrameDimensions(getDeviceDisplayDimensionsPx(device), orientation);
  const aspectRatioNumber = frame.aspectW / frame.aspectH;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-lg border border-border bg-muted"
      style={{
        width: `min(100%, calc(min(70vh, 640px) * ${aspectRatioNumber}))`,
        aspectRatio: `${frame.aspectW} / ${frame.aspectH}`,
      }}
    >
      <Image src={src} alt={alt} fill className="object-contain" sizes="448px" unoptimized />
    </div>
  );
}

export function DeviceLiveScreenshotPanel({
  device: deviceProp,
  active = false,
}: {
  device: Device;
  active?: boolean;
}) {
  useStaleOnlineTick();

  const deviceFromStore = useConsoleDevice(deviceProp.id);
  const device = deviceFromStore ?? deviceProp;
  const ownerId = useConsoleOwnerId() ?? device.owner_id;
  const patchDevice = useConsoleDataStore((state) => state.patchDevice);
  const [requesting, setRequesting] = useState(false);
  const [offlineCaptureError, setOfflineCaptureError] = useState(false);
  const pollDeadlineRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const thumbnailUrl = device.thumbnail_storage_path
    ? mediaPublicUrl(device.thumbnail_storage_path)
    : null;
  const livePath =
    device.owner_id != null ? deviceLiveScreenshotObjectPath(device.owner_id, device.id) : null;
  const liveUrl =
    livePath && device.live_screenshot_at
      ? `${mediaPublicUrl(livePath)}?v=${encodeURIComponent(device.live_screenshot_at)}`
      : null;
  const isOnline = effectiveDeviceStatus(device) === "online";

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollDeadlineRef.current = null;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pollForScreenshot = useCallback(
    async (requestedBefore: string | null) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("devices")
        .select("live_screenshot_at, screenshot_requested_at")
        .eq("id", device.id)
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      const capturedAt = data.live_screenshot_at as string | null;
      if (!capturedAt) {
        return false;
      }

      if (requestedBefore && capturedAt <= requestedBefore) {
        return false;
      }

      patchDevice(device.id, {
        live_screenshot_at: capturedAt,
        screenshot_requested_at: data.screenshot_requested_at as string | null,
      });
      return true;
    },
    [device.id, patchDevice],
  );

  const handleTakeScreenshot = useCallback(async (isCancelled: () => boolean = () => false) => {
    if (requesting || isCancelled()) return;

    if (ownerId) {
      try {
        const supabase = getSupabaseBrowserClient();
        const rows = await fetchDevicePresence(supabase, ownerId);
        if (isCancelled()) return;
        applyDevicePresenceRows(rows);
      } catch {
        /* fall through — use cached liveness */
      }
    }

    if (isCancelled()) return;

    const freshDevice = useConsoleDataStore.getState().devices.find((entry) => entry.id === device.id) ?? device;
    if (effectiveDeviceStatus(freshDevice) !== "online") {
      if (!isCancelled()) {
        setOfflineCaptureError(true);
        toast.error(OFFLINE_CAPTURE_MESSAGE, { id: `live-screenshot-offline-${device.id}` });
      }
      return;
    }

    if (isCancelled()) return;

    setRequesting(true);
    stopPolling();

    const requestedBefore = device.live_screenshot_at ?? null;
    const { error } = await requestDeviceLiveScreenshot(device.id);
    if (isCancelled()) {
      setRequesting(false);
      return;
    }
    if (error) {
      toast.error(error);
      setRequesting(false);
      return;
    }

    patchDevice(device.id, { screenshot_requested_at: new Date().toISOString() });
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

    pollTimerRef.current = setInterval(() => {
      void (async () => {
        if (isCancelled()) {
          stopPolling();
          setRequesting(false);
          return;
        }

        if (pollDeadlineRef.current != null && Date.now() > pollDeadlineRef.current) {
          stopPolling();
          setRequesting(false);
          toast.error("Timed out waiting for the screen to upload a screenshot.");
          return;
        }

        const ready = await pollForScreenshot(requestedBefore);
        if (isCancelled()) {
          stopPolling();
          setRequesting(false);
          return;
        }
        if (ready) {
          stopPolling();
          setRequesting(false);
        }
      })();
    }, POLL_INTERVAL_MS);
  }, [device, device.id, device.live_screenshot_at, ownerId, patchDevice, pollForScreenshot, requesting, stopPolling]);

  const captureRef = useRef(handleTakeScreenshot);
  captureRef.current = handleTakeScreenshot;

  useEffect(() => {
    if (!active) {
      stopPolling();
      setRequesting(false);
      setOfflineCaptureError(false);
      return;
    }

    let cancelled = false;

    void captureRef.current(() => cancelled);

    return () => {
      cancelled = true;
      stopPolling();
      setRequesting(false);
    };
  }, [active, stopPolling]);

  return (
    <div className="space-y-4">
      {requesting ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>Waiting for screen…</span>
        </div>
      ) : offlineCaptureError || !isOnline ? (
        <p className="text-sm text-muted-foreground">{OFFLINE_CAPTURE_MESSAGE}</p>
      ) : null}

      {liveUrl ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {requesting ? "Previous capture" : "Latest live capture"}
            </p>
            {device.live_screenshot_at ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatCaptureTimestamp(device.live_screenshot_at)}
              </span>
            ) : null}
          </div>
          <div className="relative overflow-hidden">
            <DeviceOrientedScreenshot
              device={device}
              src={liveUrl}
              alt="Latest live screenshot from this screen"
            />
            {requesting ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : null}
          </div>
        </div>
      ) : requesting ? (
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No live screenshot yet. Open this dialog while the screen is playing content.
        </p>
      )}

      {thumbnailUrl ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Console thumbnail</p>
          <div className="overflow-hidden">
            <DeviceOrientedScreenshot
              device={device}
              src={thumbnailUrl}
              alt="Console thumbnail for this screen"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Thumbnails customize how this screen appears in your list. They are separate from live captures.
          </p>
        </div>
      ) : null}
    </div>
  );
}
