"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeviceScreenOrientation } from "@signage/types";
import {
  imageTransitionMillis,
  type MediaCacheProgress,
  type PlaybackManifest,
} from "@/lib/browser-player/playback-types";
import { browserPlayerViewportStyle } from "@/lib/browser-player/screen-orientation";
import { TvPlayerTrialWatermark, TvPlayerLoadProgressOverlay } from "@/components/tv-player/tv-player-branding";
import { ImageSlide } from "./image-slide";
import { VideoSlide } from "./video-slide";
import { WebsiteSlide } from "./website-slide";

type PlaybackSlideshowProps = {
  manifest: PlaybackManifest;
  cacheProgress: MediaCacheProgress | null;
  onHealthy: () => void;
};

function orientationStyle(orientation: DeviceScreenOrientation): React.CSSProperties {
  return browserPlayerViewportStyle(orientation);
}

export function PlaybackSlideshow({ manifest, cacheProgress, onHealthy }: PlaybackSlideshowProps) {
  const slides = manifest.slides;
  const [index, setIndex] = useState(0);
  const [visit, setVisit] = useState(0);

  useEffect(() => {
    setIndex(0);
    setVisit(0);
  }, [manifest.contentRevision]);

  const n = slides.length;
  const slide = slides[index % n];
  const previousSlide = slides[(index - 1 + n) % n];
  const isSingleVideoPlaylist = n === 1 && slide?.fileType === "video";

  const fadeInMillis = useMemo(
    () =>
      imageTransitionMillis(
        manifest.transitionStyle,
        previousSlide?.fileType ?? "",
        slide?.fileType ?? "",
      ),
    [manifest.transitionStyle, previousSlide?.fileType, slide?.fileType],
  );

  const advance = useCallback(() => {
    if (n <= 1 && slide?.fileType === "video") return;
    setIndex((value) => (value + 1) % n);
    setVisit((value) => value + 1);
  }, [n, slide?.fileType]);

  if (!slide) return null;

  const holdImageUrl =
    slide.fileType === "video" && previousSlide && previousSlide.fileType !== "video"
      ? previousSlide.url
      : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={orientationStyle(manifest.screenOrientation)}
      >
        {slide.fileType === "video" ? (
          <VideoSlide
            key={`${visit}-${slide.url}-${manifest.contentRevision}`}
            slide={slide}
            loopSingleItem={isSingleVideoPlaylist}
            holdImageUrl={holdImageUrl}
            onDone={advance}
            onHealthy={onHealthy}
          />
        ) : slide.fileType === "website" ? (
          <WebsiteSlide
            key={`${slide.url}-${manifest.contentRevision}`}
            slide={slide}
            onDone={advance}
          />
        ) : (
          <ImageSlide
            key={`${visit}-${slide.url}-${manifest.contentRevision}`}
            slide={slide}
            fadeInMillis={fadeInMillis}
            onDone={advance}
            onHealthy={onHealthy}
          />
        )}
      </div>

      {cacheProgress ? (
        // The overlay has no positioning of its own; it expects a centering parent
        // (matches TvPlayerScreenShell behavior).
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <TvPlayerLoadProgressOverlay
            scale="full"
            headline={cacheProgress.headline}
            percent={cacheProgress.percent ?? undefined}
          />
        </div>
      ) : null}

      {manifest.showTrialWatermark ? <TvPlayerTrialWatermark scale="full" /> : null}
    </div>
  );
}
