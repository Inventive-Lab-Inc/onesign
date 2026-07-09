"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabasePublicEnv } from "@/lib/supabase/public-env";
import { reportBrowserTelemetry } from "./browser-telemetry";
import {
  fetchPlaybackRevision,
  fetchPlaybackSlides,
  loadCachedManifest,
  sendDeviceHeartbeat,
  sendDeviceOffline,
} from "./playback-api";
import { clearCachedPlayback } from "./cached-playback";
import { clearPlayerRegistration, readPlayerStorage, playerStorageKeys } from "./device-storage";
import { maybeCaptureLiveScreenshot, resetLiveScreenshotState } from "./live-screenshot";
import { MediaCacheCoordinator } from "./media-cache-coordinator";
import { PlaybackRealtimeCoordinator } from "./playback-realtime";
import { getPlayerSupabaseClient } from "./player-supabase";
import { pollUntilLinked, registerOrRestoreDevice } from "./register-device";
import {
  HEARTBEAT_INTERVAL_MS,
  POLL_INTERVAL_MS,
  TELEMETRY_INTERVAL_MS,
  type BrowserPlayerPhase,
  type MediaCacheProgress,
  type PlaybackManifest,
  type PlaybackRevision,
} from "./playback-types";

export type BrowserPlayerState = {
  phase: BrowserPlayerPhase;
  pairingCode: string | null;
  deviceName: string | null;
  manifest: PlaybackManifest | null;
  cacheProgress: MediaCacheProgress | null;
  errorMessage: string | null;
  retry: () => void;
  captureRef: React.RefObject<HTMLDivElement>;
  requestWakeLock: () => Promise<void>;
  requestFullscreen: () => Promise<void>;
};

function resolvePhase(manifest: PlaybackManifest | null): BrowserPlayerPhase {
  if (!manifest) return "no-playlist";

  if (manifest.playbackDisabled) {
    switch (manifest.playbackBlockReason) {
      case "account_suspended":
        return "account-suspended";
      case "paused_by_quota":
        return "paused-quota";
      default:
        return "disabled";
    }
  }

  if (manifest.outsideOperatingHours) {
    return manifest.blankWhenOffHours ? "off-hours-blank" : "off-hours-standby";
  }

  if (!manifest.playlistId) return "no-playlist";
  if (manifest.slides.length === 0) return "empty-playlist";
  return "playing";
}

export function useBrowserPlayer(): BrowserPlayerState {
  const [phase, setPhase] = useState<BrowserPlayerPhase>("initializing");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [manifest, setManifest] = useState<PlaybackManifest | null>(null);
  const [cacheProgress, setCacheProgress] = useState<MediaCacheProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bootToken, setBootToken] = useState(0);

  const captureRef = useRef<HTMLDivElement | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const manifestRef = useRef<PlaybackManifest | null>(null);
  const revisionRef = useRef<PlaybackRevision | null>(null);
  const mediaCacheRef = useRef<MediaCacheCoordinator | null>(null);
  const realtimeRef = useRef<PlaybackRealtimeCoordinator | null>(null);
  const pollFastRef = useRef(false);

  const supabase = useMemo(() => getPlayerSupabaseClient(), []);

  useEffect(() => {
    manifestRef.current = manifest;
  }, [manifest]);

  useEffect(() => {
    mediaCacheRef.current = new MediaCacheCoordinator((state) => {
      setCacheProgress(
        state ? { headline: state.headline, percent: state.percent } : null,
      );
    });
    realtimeRef.current = new PlaybackRealtimeCoordinator();
    return () => {
      realtimeRef.current?.tearDown(supabase);
    };
  }, [supabase]);

  const applyManifest = useCallback((next: PlaybackManifest | null) => {
    setManifest(next);
    setDeviceName(next?.deviceName ?? null);
    setPhase(resolvePhase(next));
    if (next && next.slides.length > 0) {
      mediaCacheRef.current?.onPlaybackActive(next.slides, next.contentRevision, 0);
    }
  }, []);

  const loadManifestIfNeeded = useCallback(
    async (deviceId: string, revision: PlaybackRevision, nameFallback: string) => {
      const current = manifestRef.current;
      const revisionChanged =
        revision.contentRevision !== current?.contentRevision ||
        revision.playlistId !== current?.playlistId;
      const orientationChanged =
        revision.screenOrientation !== current?.screenOrientation;

      if (!revisionChanged && current?.deviceId === deviceId) {
        if (!orientationChanged && revision.deviceName?.trim() === current.deviceName) {
          return;
        }
        const patched: PlaybackManifest = {
          ...current,
          deviceName: revision.deviceName?.trim() || current.deviceName,
          screenOrientation: revision.screenOrientation,
          showTrialWatermark: revision.showTrialWatermark,
          isFromCache: false,
        };
        applyManifest(patched);
        return;
      }

      try {
        const loaded = await fetchPlaybackSlides(deviceId, nameFallback, current);
        if (!loaded) {
          clearPlayerRegistration();
          resetLiveScreenshotState();
          setPhase("pairing");
          setBootToken((value) => value + 1);
          return;
        }
        applyManifest(loaded);
      } catch {
        const cached = loadCachedManifest(deviceId);
        if (cached) {
          applyManifest(cached);
        } else {
          setPhase("error-connection");
        }
      }
    },
    [applyManifest],
  );

  const runPlaybackLoop = useCallback(
    async (deviceId: string, initialName: string, signal: AbortSignal) => {
      deviceIdRef.current = deviceId;
      setDeviceName(initialName);

      const cached = loadCachedManifest(deviceId);
      if (cached) {
        applyManifest(cached);
      }

      realtimeRef.current?.update(supabase, deviceId, cached?.playlistId ?? null, () => {
        pollFastRef.current = true;
      });

      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let telemetryTimer: ReturnType<typeof setInterval> | null = null;

      const heartbeat = async () => {
        try {
          await sendDeviceHeartbeat(deviceId);
        } catch {
          // ignore transient failures
        }
      };

      const telemetry = async () => {
        try {
          const current = manifestRef.current;
          const cacheSnapshot = mediaCacheRef.current?.snapshot(
            current?.slides ?? [],
            current?.contentRevision ?? null,
          );
          await reportBrowserTelemetry(
            supabase,
            deviceId,
            readPlayerStorage(playerStorageKeys.playbackSecret),
            current?.contentRevision ?? null,
            cacheSnapshot ?? null,
          );
        } catch {
          // ignore
        }
      };

      void heartbeat();
      void telemetry();
      heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);
      telemetryTimer = setInterval(() => void telemetry(), TELEMETRY_INTERVAL_MS);

      let consecutivePollFailures = 0;
      const maxConsecutivePollFailures = 3;

      try {
        while (!signal.aborted) {
          try {
            const revision = await fetchPlaybackRevision(deviceId);
            revisionRef.current = revision;

            if (!revision.ok) {
              clearPlayerRegistration();
              resetLiveScreenshotState();
              setBootToken((value) => value + 1);
              return;
            }

            consecutivePollFailures = 0;

            realtimeRef.current?.update(supabase, deviceId, revision.playlistId, () => {
              pollFastRef.current = true;
            });

            void maybeCaptureLiveScreenshot(
              deviceId,
              revision.screenshotRequestedAt,
              captureRef.current,
            ).then((uploaded) => {
              if (uploaded) void heartbeat();
            });

            await loadManifestIfNeeded(
              deviceId,
              revision,
              revision.deviceName?.trim() || initialName,
            );
          } catch {
            consecutivePollFailures += 1;
            if (consecutivePollFailures >= maxConsecutivePollFailures) {
              clearPlayerRegistration();
              resetLiveScreenshotState();
              setBootToken((value) => value + 1);
              return;
            }
            if (!manifestRef.current) {
              setPhase("error-connection");
            }
          }

          const waitMs = pollFastRef.current ? 250 : POLL_INTERVAL_MS;
          pollFastRef.current = false;
          await sleep(waitMs, signal);
        }
      } finally {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (telemetryTimer) clearInterval(telemetryTimer);
      }
    },
    [applyManifest, loadManifestIfNeeded, supabase],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function boot() {
      setPhase("initializing");
      setErrorMessage(null);
      resetLiveScreenshotState();

      try {
        getSupabasePublicEnvCheck();
        const result = await registerOrRestoreDevice();
        setPairingCode(result.pairing_code);
        deviceIdRef.current = result.device_id;

        if (result.owner_id) {
          await runPlaybackLoop(result.device_id, "Display", controller.signal);
          return;
        }

        setPhase("pairing");
        await pollUntilLinked(
          result.device_id,
          (name) => {
            void runPlaybackLoop(result.device_id, name, controller.signal);
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if ((err as Error).message === "device_not_found") {
          clearCachedPlayback();
          setBootToken((value) => value + 1);
          return;
        }
        if ((err as Error).message?.includes("Supabase")) {
          setPhase("missing-config");
        } else {
          setPhase("error-connection");
          setErrorMessage(err instanceof Error ? err.message : "Connection failed");
        }
      }
    }

    void boot();

    return () => {
      controller.abort();
      const deviceId = deviceIdRef.current;
      if (deviceId) void sendDeviceOffline(deviceId);
    };
  }, [bootToken, runPlaybackLoop]);

  useEffect(() => {
    function onPageHide() {
      const deviceId = deviceIdRef.current;
      if (deviceId) void sendDeviceOffline(deviceId);
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const retry = useCallback(() => {
    clearPlayerRegistration();
    clearCachedPlayback();
    resetLiveScreenshotState();
    setBootToken((value) => value + 1);
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        await (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<unknown> } }).wakeLock.request("screen");
      }
    } catch {
      // unsupported or denied
    }
  }, []);

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // user denied
    }
  }, []);

  return {
    phase,
    pairingCode,
    deviceName,
    manifest,
    cacheProgress,
    errorMessage,
    retry,
    captureRef,
    requestWakeLock,
    requestFullscreen,
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function getSupabasePublicEnvCheck(): void {
  if (!getSupabasePublicEnv()) {
    throw new Error("Missing Supabase configuration");
  }
}
