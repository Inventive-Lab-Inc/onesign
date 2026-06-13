"use client";

import { useEffect, useState } from "react";

/** SSR-safe default — must match server render before hydration. */
const SSR_WIDTH = 1280;

export function useBreakpoint() {
  const [width, setWidth] = useState(SSR_WIDTH);

  useEffect(() => {
    const sync = () => setWidth(window.innerWidth);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    width,
  };
}
