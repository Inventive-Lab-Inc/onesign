"use client";

import { useEffect, useRef } from "react";
import type { PlaybackSlide } from "@/lib/browser-player/playback-types";

type VideoSlideProps = {
  slide: PlaybackSlide;
  loopSingleItem: boolean;
  holdImageUrl: string | null;
  onDone: () => void;
  onHealthy: () => void;
};

export function VideoSlide({
  slide,
  loopSingleItem,
  holdImageUrl,
  onDone,
  onHealthy,
}: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.load();
    const playPromise = video.play();
    if (playPromise) {
      void playPromise.catch(() => {
        video.muted = true;
        void video.play().catch(() => undefined);
      });
    }

    const onPlaying = () => onHealthy();
    video.addEventListener("playing", onPlaying);
    return () => video.removeEventListener("playing", onPlaying);
  }, [slide.url, onHealthy]);

  return (
    <div className="absolute inset-0 bg-black">
      {holdImageUrl ? (
        <img src={holdImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <video
        ref={videoRef}
        src={slide.url}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        loop={loopSingleItem}
        onEnded={() => {
          if (!loopSingleItem) onDone();
        }}
      />
    </div>
  );
}
