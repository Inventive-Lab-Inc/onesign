"use client";

import { useEffect } from "react";
import type { PlaybackSlide } from "@/lib/browser-player/playback-types";

type WebsiteSlideProps = {
  slide: PlaybackSlide;
  onDone: () => void;
};

export function WebsiteSlide({ slide, onDone }: WebsiteSlideProps) {
  const dwellMs =
    Math.min(3_600, Math.max(5, slide.durationSeconds ?? 30)) * 1000;
  const zoom = Math.min(200, Math.max(25, slide.zoomLevel ?? 100)) / 100;

  useEffect(() => {
    const timer = window.setTimeout(onDone, dwellMs);
    return () => window.clearTimeout(timer);
  }, [slide.url, zoom, dwellMs, onDone]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <iframe
        src={slide.url}
        title="Website slide"
        className="h-full w-full border-0"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          width: `${100 / zoom}%`,
          height: `${100 / zoom}%`,
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
