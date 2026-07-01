"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";

export interface MockupSlide {
  src: string;
  alt: string;
  tag: string;
  title: string;
}

const SLIDE_DURATION_MS = 1800;

/** Auto-rotating showcase of real-world signage mockups — click to pause/play;
 *  respects reduced-motion by disabling autoplay (dots still work). */
export function LandingMockupSlideshow({ slides }: { slides: MockupSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAutoplayEnabled(!query.matches);
    const onChange = () => setAutoplayEnabled(!query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || !autoplayEnabled) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(id);
  }, [paused, autoplayEnabled, slides.length]);

  const active = slides[index];
  if (!active) return null;

  const isPlaying = autoplayEnabled && !paused;
  const togglePaused = () => setPaused((current) => !current);

  return (
    <div className="landing-slideshow">
      <button
        type="button"
        className={`landing-showcase-stage landing-slideshow-frame landing-slideshow-toggle${autoplayEnabled ? "" : " landing-slideshow-toggle--static"}`}
        onClick={autoplayEnabled ? togglePaused : undefined}
        aria-label={autoplayEnabled ? (isPlaying ? "Pause slideshow" : "Play slideshow") : undefined}
        aria-pressed={autoplayEnabled ? !isPlaying : undefined}
      >
        {slides.map((slide, i) => (
          <div key={slide.src} className="landing-slideshow-slide" aria-hidden={i !== index} style={{ opacity: i === index ? 1 : 0 }}>
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="(min-width: 1152px) 1152px, 100vw"
              priority={i === 0}
              className="object-cover"
            />
          </div>
        ))}
        <span className="landing-slideshow-playback" aria-hidden="true">
          {autoplayEnabled ? (
            isPlaying ? <Pause size={14} strokeWidth={2.5} /> : <Play size={14} strokeWidth={2.5} />
          ) : null}
        </span>
        <div className="landing-slideshow-caption">
          <span className="landing-slideshow-tag">{active.tag}</span>
          <p className="landing-slideshow-title">{active.title}</p>
        </div>
      </button>

      <div className="landing-slideshow-dots" role="tablist" aria-label="Signage showcase slides">
        {slides.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={slide.tag}
            data-active={i === index}
            className="landing-slideshow-dot"
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
