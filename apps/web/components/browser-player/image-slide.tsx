"use client";

import { useEffect, useState } from "react";
import type { PlaybackSlide } from "@/lib/browser-player/playback-types";
import { imageSlideDwellMs } from "@/lib/browser-player/playback-types";
import { cn } from "@/lib/utils";

type ImageSlideProps = {
  slide: PlaybackSlide;
  fadeInMillis: number;
  onDone: () => void;
  onHealthy: () => void;
};

export function ImageSlide({ slide, fadeInMillis, onDone, onHealthy }: ImageSlideProps) {
  const [visible, setVisible] = useState(fadeInMillis === 0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setVisible(fadeInMillis === 0);
    setLoaded(false);
  }, [slide.url, fadeInMillis]);

  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;
    const dwellMs = imageSlideDwellMs(slide.durationSeconds, fadeInMillis);

    const run = async () => {
      if (fadeInMillis > 0) {
        setVisible(true);
        await delay(fadeInMillis);
      }
      if (cancelled) return;

      let remaining = dwellMs;
      while (remaining > 0 && !cancelled) {
        const chunk = Math.min(remaining, 25_000);
        await delay(chunk);
        remaining -= chunk;
        onHealthy();
      }
      if (!cancelled) onDone();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loaded, slide.url, slide.durationSeconds, fadeInMillis, onDone, onHealthy]);

  return (
    <img
      src={slide.url}
      alt=""
      className={cn(
        "absolute inset-0 h-full w-full object-cover transition-opacity",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ transitionDuration: `${fadeInMillis}ms` }}
      onLoad={() => setLoaded(true)}
      onError={() => {
        onHealthy();
        window.setTimeout(onDone, 8_000);
      }}
    />
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
