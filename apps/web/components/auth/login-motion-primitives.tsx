"use client";

import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const EASE_PREMIUM = [0.05, 0.7, 0.1, 1] as const;

type ParallaxMotion = ReturnType<typeof useMotionValue<number>>;

const ParallaxContext = createContext<{ mouseX: ParallaxMotion; mouseY: ParallaxMotion } | null>(null);

export function ParallaxProvider({
  mouseX,
  mouseY,
  children,
}: {
  mouseX: ParallaxMotion;
  mouseY: ParallaxMotion;
  children: ReactNode;
}) {
  return <ParallaxContext.Provider value={{ mouseX, mouseY }}>{children}</ParallaxContext.Provider>;
}

export function useParallax() {
  const ctx = useContext(ParallaxContext);
  if (!ctx) throw new Error("useParallax requires ParallaxProvider");
  return ctx;
}

/* ── realistic signage display ── */

export interface AdContent {
  id: string;
  background: string;
  overlay?: string;
  art?: ReactNode;
  children: ReactNode;
}

export type FrameStyle =
  | "chalkboard"
  | "wood-tablet"
  | "a-frame"
  | "ultrathin"
  | "shelf-strip"
  | "kiosk"
  | "industrial"
  | "flush-mount"
  | "led-column"
  | "luxury-gold"
  | "brass-plaque"
  | "marble-kiosk"
  | "clinical-white"
  | "wall-panel"
  | "wayfinding";

const FRAME_FEATURES: Record<
  FrameStyle,
  { led: boolean; scan: boolean; mesh: boolean; brand: boolean; mount?: string }
> = {
  chalkboard: { led: false, scan: false, mesh: false, brand: false, mount: "hook" },
  "wood-tablet": { led: true, scan: false, mesh: false, brand: false, mount: "stand" },
  "a-frame": { led: false, scan: false, mesh: false, brand: false, mount: "legs" },
  ultrathin: { led: true, scan: true, mesh: true, brand: true, mount: "none" },
  "shelf-strip": { led: true, scan: false, mesh: true, brand: false, mount: "none" },
  kiosk: { led: true, scan: true, mesh: true, brand: true, mount: "pedestal" },
  industrial: { led: true, scan: false, mesh: false, brand: false, mount: "bracket" },
  "flush-mount": { led: false, scan: false, mesh: true, brand: false, mount: "none" },
  "led-column": { led: false, scan: true, mesh: false, brand: false, mount: "none" },
  "luxury-gold": { led: true, scan: false, mesh: false, brand: false, mount: "none" },
  "brass-plaque": { led: false, scan: false, mesh: false, brand: false, mount: "none" },
  "marble-kiosk": { led: true, scan: false, mesh: false, brand: false, mount: "pedestal" },
  "clinical-white": { led: true, scan: false, mesh: false, brand: false, mount: "none" },
  "wall-panel": { led: true, scan: false, mesh: false, brand: false, mount: "none" },
  wayfinding: { led: false, scan: false, mesh: false, brand: false, mount: "totem" },
};

export function SignageDisplay({
  ads,
  className,
  size = "hero",
  frame = "ultrathin",
  tilt = { x: 4, y: -6 },
  delay = 0,
}: {
  ads: AdContent[];
  className?: string;
  size?: "hero" | "medium" | "portrait";
  frame?: FrameStyle;
  tilt?: { x: number; y: number };
  delay?: number;
}) {
  const [index, setIndex] = useState(0);
  const [powered, setPowered] = useState(false);

  useEffect(() => {
    const boot = setTimeout(() => setPowered(true), delay * 1000 + 200);
    return () => clearTimeout(boot);
  }, [delay]);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % ads.length), 4200);
    return () => clearInterval(t);
  }, [ads.length]);

  const ad = ads[index] ?? ads[0];
  const features = FRAME_FEATURES[frame];

  return (
    <motion.div
      className={`lm-display lm-display--${size} lm-display--frame-${frame} ${className ?? ""}`}
      initial={{ opacity: 0, y: 32, scale: 0.94 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -4, 0],
        rotateZ: [0, 0.6, 0, -0.5, 0],
      }}
      transition={{
        opacity: { duration: 0.8, delay, ease: EASE_PREMIUM },
        y: { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.6 },
        rotateZ: { duration: 8, repeat: Infinity, ease: "easeInOut", delay: delay + 1 },
        scale: { duration: 0.8, delay, ease: EASE_PREMIUM },
      }}
    >
      <motion.div
        className="lm-display__tilt"
        initial={{ rotateX: tilt.x + 14, rotateY: tilt.y + 8 }}
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ duration: 1, delay, ease: EASE_PREMIUM }}
        style={{ transformPerspective: 900, transformStyle: "preserve-3d" }}
      >
        <div className="lm-display__shadow" aria-hidden />
        {features.mount && features.mount !== "none" && (
          <div className={`lm-display__mount lm-display__mount--${features.mount}`} aria-hidden />
        )}
        <div className="lm-display__frame">
          <div className="lm-display__bezel">
            {!powered && <div className="lm-display__boot" aria-hidden />}
            <AnimatePresence mode="popLayout">
              {ad && powered && (
                <motion.div
                  key={ad.id}
                  className="lm-display__content"
                  style={{ background: ad.background }}
                  initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)", filter: "brightness(1.4)" }}
                  animate={{
                    opacity: 1,
                    clipPath: "inset(0 0% 0 0)",
                    scale: [1, 1.05],
                    filter: "brightness(1)",
                  }}
                  exit={{ opacity: 0, clipPath: "inset(0 0 0 100%)", filter: "brightness(0.7)" }}
                  transition={{
                    opacity: { duration: 0.45, ease: EASE_PREMIUM },
                    clipPath: { duration: 0.65, ease: EASE_PREMIUM },
                    scale: { duration: 4.2, ease: "linear" },
                    filter: { duration: 0.45 },
                  }}
                >
                  {ad.overlay && <div className="lm-display__overlay" style={{ background: ad.overlay }} />}
                  {ad.art && <div className="lm-display__art">{ad.art}</div>}
                  <div className="lm-display__text">{ad.children}</div>
                  <div className="lm-display__vignette" aria-hidden />
                </motion.div>
              )}
            </AnimatePresence>
            {features.mesh && <div className="lm-display__mesh" aria-hidden />}
            <div className="lm-display__glass" aria-hidden />
            {features.scan && (
              <motion.div
                className="lm-display__scan"
                animate={{ y: ["-120%", "220%"] }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
                aria-hidden
              />
            )}
            <div className="lm-display__reflection" aria-hidden />
          </div>
          {features.led && <div className="lm-display__led" aria-hidden />}
          {features.brand && <div className="lm-display__brand" aria-hidden>OneSign</div>}
        </div>
        <motion.div
          className="lm-display__bloom"
          animate={{ opacity: [0.3, 0.72, 0.3], scale: [0.95, 1.08, 0.95] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      </motion.div>
    </motion.div>
  );
}

/* ── ambient particles ── */

function AmbientDust({ count = 22, color = "rgba(255,255,255,0.4)" }: { count?: number; color?: string }) {
  const seeds = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i * 17 + 7) % 100,
    y: (i * 23 + 11) % 100,
    size: 1 + (i % 4) * 0.5,
    duration: 5 + (i % 6),
    delay: (i % 9) * 0.35,
    drift: (i % 5) - 2,
  }));

  return (
    <div className="lm-dust" aria-hidden>
      {seeds.map((p) => (
        <motion.span
          key={p.id}
          className="lm-dust__mote"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: color }}
          animate={{ y: [0, -55, 0], x: [0, p.drift * 8, 0], opacity: [0, 0.85, 0] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function LightPool({ color, style }: { color: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className="lm-light-pool"
      style={{ background: color, ...style }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.75, 0.35] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

function LightRay({ style }: { style?: React.CSSProperties }) {
  return (
    <motion.div
      className="lm-light-ray"
      style={style}
      animate={{ opacity: [0.08, 0.22, 0.08], rotate: [0, 2, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

export function AmbientLayer({
  variant,
  extras,
}: {
  variant: "warm" | "cool" | "neon" | "gold" | "clinical";
  extras?: ReactNode;
}) {
  const pools: Record<string, { c1: string; c2: string; c3: string; dust: string }> = {
    warm: {
      c1: "rgba(245,158,11,0.32)",
      c2: "rgba(220,38,38,0.16)",
      c3: "rgba(251,191,36,0.12)",
      dust: "rgba(251,191,36,0.55)",
    },
    cool: {
      c1: "rgba(99,102,241,0.24)",
      c2: "rgba(236,72,153,0.18)",
      c3: "rgba(167,139,250,0.1)",
      dust: "rgba(255,255,255,0.4)",
    },
    neon: {
      c1: "rgba(163,230,53,0.22)",
      c2: "rgba(6,182,212,0.16)",
      c3: "rgba(34,211,238,0.1)",
      dust: "rgba(163,230,53,0.5)",
    },
    gold: {
      c1: "rgba(202,138,4,0.28)",
      c2: "rgba(253,224,71,0.14)",
      c3: "rgba(234,179,8,0.1)",
      dust: "rgba(253,224,71,0.45)",
    },
    clinical: {
      c1: "rgba(45,212,191,0.24)",
      c2: "rgba(14,165,233,0.14)",
      c3: "rgba(255,255,255,0.08)",
      dust: "rgba(255,255,255,0.55)",
    },
  };
  const fallback = {
    c1: "rgba(245,158,11,0.32)",
    c2: "rgba(220,38,38,0.16)",
    c3: "rgba(251,191,36,0.12)",
    dust: "rgba(251,191,36,0.55)",
  };
  const p = pools[variant] ?? fallback;

  return (
    <>
      <LightPool color={p.c1} style={{ top: "2%", left: "10%", width: "50%", height: "45%" }} />
      <LightPool color={p.c2} style={{ bottom: "20%", right: "5%", width: "40%", height: "35%" }} />
      <LightPool color={p.c3} style={{ top: "35%", left: "45%", width: "30%", height: "25%" }} />
      <LightRay style={{ top: "0%", left: "25%", width: "18%", height: "70%" }} />
      <LightRay style={{ top: "5%", right: "20%", width: "14%", height: "65%", transform: "rotate(8deg)" }} />
      <AmbientDust color={p.dust} />
      {extras}
      <div className="lm-grain" aria-hidden />
    </>
  );
}

/* ── parallax stage wrapper ── */

export function MotionStage({
  children,
  mouseX,
  mouseY,
}: {
  children: ReactNode;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}) {
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [6, -6]);
  const rotateX = useTransform(mouseY, [-0.5, 0.5], [-5, 5]);
  const springY = useSpring(rotateY, { stiffness: 55, damping: 16 });
  const springX = useSpring(rotateX, { stiffness: 55, damping: 16 });

  return (
    <motion.div className="lm-stage-inner" style={{ rotateY: springY, rotateX: springX, transformPerspective: 1100 }}>
      {children}
    </motion.div>
  );
}

/* ── typography helpers for ads ── */

export function AdTag({ children }: { children: ReactNode }) {
  return (
    <motion.span
      className="lm-ad-tag"
      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: 0.2, duration: 0.45, ease: EASE_PREMIUM }}
    >
      {children}
    </motion.span>
  );
}

export function AdTitle({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <motion.h3
      className={`lm-ad-title${dark ? " lm-ad-title--dark" : ""}`}
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: 0.28, duration: 0.5, ease: EASE_PREMIUM }}
    >
      {children}
    </motion.h3>
  );
}

export function AdSub({ children }: { children: ReactNode }) {
  return (
    <motion.p
      className="lm-ad-sub"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38, duration: 0.45, ease: EASE_PREMIUM }}
    >
      {children}
    </motion.p>
  );
}

export function AdPrice({ children }: { children: ReactNode }) {
  return (
    <motion.span
      className="lm-ad-price"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.42, type: "spring", stiffness: 220, damping: 14 }}
    >
      {children}
    </motion.span>
  );
}

export { AnimatePresence, motion, EASE_PREMIUM, useMotionValue };
