"use client";

import { useEffect } from "react";
import { TvPlayerScreen } from "@/components/tv-player/tv-player-screen";
import { TV_PLAYER_BG } from "@/components/tv-player/tv-player-branding";
import { deviceUiTvCopy as copy } from "@/lib/device-ui-copy";
import { useBrowserPlayer } from "@/lib/browser-player/use-browser-player";
import { lockBrowserScreenOrientation } from "@/lib/browser-player/screen-orientation";
import { PlaybackSlideshow } from "./playback-slideshow";

export function BrowserPlayerApp() {
  const {
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
  } = useBrowserPlayer();

  const showPlayback = phase === "playing" && manifest && manifest.slides.length > 0;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.backgroundColor = TV_PLAYER_BG;
    body.style.backgroundColor = TV_PLAYER_BG;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    void requestWakeLock();
  }, [requestWakeLock]);

  useEffect(() => {
    function onFirstInteraction() {
      void requestFullscreen();
      void requestWakeLock();
      window.removeEventListener("pointerdown", onFirstInteraction);
    }
    window.addEventListener("pointerdown", onFirstInteraction);
    return () => window.removeEventListener("pointerdown", onFirstInteraction);
  }, [requestFullscreen, requestWakeLock]);

  useEffect(() => {
    if (!showPlayback || !manifest?.screenOrientation) return;
    void lockBrowserScreenOrientation(manifest.screenOrientation);
  }, [showPlayback, manifest?.screenOrientation]);

  // Use fixed inset-0 (not 100dvh): many Smart TV browsers ignore/misreport dvh,
  // which collapses the player into a short strip over the light body background
  // and clips the pairing code. inset-0 sizes against the viewport without vh units.
  return (
    <div
      ref={captureRef}
      className="fixed inset-0 z-0 overflow-hidden text-white"
      style={{ backgroundColor: TV_PLAYER_BG }}
    >
      {showPlayback ? (
        <PlaybackSlideshow
          manifest={manifest}
          cacheProgress={cacheProgress}
          onHealthy={() => undefined}
        />
      ) : (
        <TvPlayerScreen
          scale="full"
          phaseId={phase}
          pairingCode={pairingCode ?? undefined}
          deviceName={deviceName ?? undefined}
          statusLine={errorMessage ?? undefined}
          primaryAction={phase === "error-connection" ? copy.errorConnection.action : undefined}
        />
      )}

      {phase === "error-connection" ? (
        <button
          type="button"
          className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/20 bg-white/10 px-8 py-3 text-lg text-white backdrop-blur hover:bg-white/15"
          onClick={retry}
        >
          {copy.errorConnection.action}
        </button>
      ) : null}
    </div>
  );
}
