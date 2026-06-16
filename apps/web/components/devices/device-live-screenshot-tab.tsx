"use client";

import type { Device } from "@signage/types";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export function DeviceLiveScreenshotTab({ device: deviceProp }: { device: Device }) {
  useStaleOnlineTick();

  const deviceFromStore = useConsoleDevice(deviceProp.id);
  const device = deviceFromStore ?? deviceProp;
  const ownerId = useConsoleOwnerId() ?? device.owner_id;
  const patchDevice = useConsoleDataStore((s) => s.patchDevice);
  const [requesting, setRequesting] = useState(false);
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

  const handleTakeScreenshot = useCallback(async () => {
    if (requesting) return;

    if (ownerId) {
      try {
        const supabase = getSupabaseBrowserClient();
        const rows = await fetchDevicePresence(supabase, ownerId);
        applyDevicePresenceRows(rows);
      } catch {
        /* fall through — use cached liveness */
      }
    }

    const freshDevice = useConsoleDataStore.getState().devices.find((entry) => entry.id === device.id) ?? device;
    if (effectiveDeviceStatus(freshDevice) !== "online") {
      toast.error("The screen must be online to capture a live screenshot.");
      return;
    }

    setRequesting(true);
    stopPolling();

    const requestedBefore = device.live_screenshot_at ?? null;
    const { error } = await requestDeviceLiveScreenshot(device.id);
    if (error) {
      toast.error(error);
      setRequesting(false);
      return;
    }

    patchDevice(device.id, { screenshot_requested_at: new Date().toISOString() });
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

    pollTimerRef.current = setInterval(() => {
      void (async () => {
        if (pollDeadlineRef.current != null && Date.now() > pollDeadlineRef.current) {
          stopPolling();
          setRequesting(false);
          toast.error("Timed out waiting for the screen to upload a screenshot.");
          return;
        }

        const ready = await pollForScreenshot(requestedBefore);
        if (ready) {
          stopPolling();
          setRequesting(false);
          toast.success("Live screenshot captured.");
        }
      })();
    }, POLL_INTERVAL_MS);
  }, [device, device.id, device.live_screenshot_at, ownerId, patchDevice, pollForScreenshot, requesting, stopPolling]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={requesting || !isOnline} onClick={() => void handleTakeScreenshot()}>
          {requesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {requesting ? "Waiting for screen…" : "Take live screenshot"}
        </Button>
        {!isOnline ? (
          <p className="text-xs text-muted-foreground">Screen must be online.</p>
        ) : null}
      </div>

      {liveUrl ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest live capture</p>
          <div className="overflow-hidden">
            <DeviceOrientedScreenshot
              device={device}
              src={liveUrl}
              alt="Latest live screenshot from this screen"
            />
          </div>
          {device.live_screenshot_at ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              Captured {new Date(device.live_screenshot_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No live screenshot yet. Press the button above while the screen is playing content.
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
