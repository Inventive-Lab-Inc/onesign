"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  EASE_PREMIUM,
  ParallaxProvider,
} from "./login-motion-primitives";
import { BUSINESS_SCENES } from "./login-motion-scenes";
import "./login-motion.css";

const SLIDE_MS = 6000;

interface LoginMotionPanelProps {
  title: string;
  subtitle: string;
}

export function LoginMotionPanel({ title, subtitle }: LoginMotionPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = setInterval(
      () => setActiveIndex((i) => (i + 1) % BUSINESS_SCENES.length),
      SLIDE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    function onMove(e: MouseEvent) {
      mouseX.set(e.clientX / window.innerWidth - 0.5);
      mouseY.set(e.clientY / window.innerHeight - 0.5);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  const active = BUSINESS_SCENES[activeIndex] ?? BUSINESS_SCENES[0];
  const Scene = active.Scene;

  return (
    <motion.div
      className="lm"
      animate={{ backgroundColor: active.bg }}
      transition={{ duration: 0.9, ease: EASE_PREMIUM }}
    >
      <div className="lm__stage-wrap">
        <ParallaxProvider mouseX={mouseX} mouseY={mouseY}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              className="lm-scene"
              initial={{ opacity: 0, filter: "blur(12px)", scale: 1.05 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(10px)", scale: 0.96 }}
              transition={{ duration: 0.9, ease: EASE_PREMIUM }}
              style={{ position: "absolute", inset: 0 }}
            >
              <Scene />
            </motion.div>
          </AnimatePresence>
        </ParallaxProvider>
        <div className="lm__fade" aria-hidden />
      </div>

      <div className="lm__footer">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: EASE_PREMIUM }}
          >
            <div className="lm__badge">{active.badge}</div>
          </motion.div>
        </AnimatePresence>
        <h1 className="lm__title">{title}</h1>
        <p className="lm__subtitle">{subtitle}</p>
        <div className="lm__dots" aria-hidden>
          {BUSINESS_SCENES.map((scene, i) => (
            <motion.div
              key={scene.id}
              className={`lm__dot${i === activeIndex ? " lm__dot--active" : ""}`}
              animate={i === activeIndex ? { scale: 1.4 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
