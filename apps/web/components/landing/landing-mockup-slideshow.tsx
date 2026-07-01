"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export interface MockupSlide {
  src: string;
  alt: string;
  tag: string;
  title: string;
}

const SLIDE_DURATION_MS = 2800;

/** Auto-rotating showcase of real-world signage mockups — pauses on hover/focus
 *  and respects reduced-motion by disabling autoplay (dots still work). */
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

  return (
    <div
      className="landing-slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="landing-showcase-stage landing-slideshow-frame">
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
        <div className="landing-slideshow-caption">
          <span className="landing-slideshow-tag">{active.tag}</span>
          <p className="landing-slideshow-title">{active.title}</p>
        </div>
      </div>

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
