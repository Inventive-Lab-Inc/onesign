import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

const STATS = [
  { value: "1,000+", label: "Screens powered" },
  { value: "99.9%", label: "Player uptime" },
  { value: "<5s", label: "To publish live" },
] as const;

const SCREENS = [
  {
    label: "Lobby Display",
    accent: "from-[#22d3a8] to-[#0ea5e9]",
    className: "left-0 top-4 w-[13.5rem] -rotate-[7deg]",
    delay: "0s",
  },
  {
    label: "Menu Board",
    accent: "from-[#f5c451] to-[#f97362]",
    className: "left-1/2 top-0 w-[15rem] -translate-x-1/2 rotate-[2deg]",
    delay: "0.4s",
  },
  {
    label: "Window Promo",
    accent: "from-[#c084fc] to-[#6366f1]",
    className: "right-0 top-10 w-[13rem] rotate-[8deg]",
    delay: "0.8s",
  },
] as const;

interface AuthHeroPanelProps {
  eyebrow: string;
  headline: ReactNode;
  subline: ReactNode;
}

/** Decorative brand panel shared by the login and signup screens — hidden below `lg`. */
export function AuthHeroPanel({ eyebrow, headline, subline }: AuthHeroPanelProps) {
  return (
    <div className="relative hidden overflow-hidden bg-[linear-gradient(160deg,var(--theme-shell-dark)_0%,var(--theme-shell-light)_100%)] lg:flex lg:w-[46%] lg:shrink-0 lg:flex-col xl:w-1/2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "2.5rem 2.5rem",
          maskImage: "radial-gradient(ellipse 60% 50% at 50% 40%, black 40%, transparent 85%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-[var(--theme)] opacity-25 blur-[6rem]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sky-400 opacity-[0.12] blur-[6rem]"
      />

      <div className="relative flex h-full flex-col items-start justify-between px-12 py-12 xl:px-16 xl:py-14">
        <Logo height={30} tone="light" />

        <div className="max-w-md">
          <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-emerald-300/80">
            {eyebrow}
          </span>
          <h1 className="mt-4 text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-white xl:text-[2.875rem]">
            {headline}
          </h1>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-white/60">{subline}</p>

          <div className="relative mt-14 h-[13rem]">
            {SCREENS.map((screen) => (
              // Outer element owns the static position + tilt; the inner element owns the
              // float animation, since both write to `transform` and would otherwise clash.
              <div key={screen.label} className={`absolute ${screen.className}`}>
                <div
                  className="login-hero-float overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] shadow-[0_1.5rem_3rem_-1rem_rgba(0,0,0,0.55)] backdrop-blur-sm"
                  style={{ animationDelay: screen.delay }}
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <span className="text-[0.6875rem] font-medium text-white/70">
                      {screen.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="font-mono text-[0.5625rem] uppercase tracking-wide text-emerald-300/80">
                        Live
                      </span>
                    </span>
                  </div>
                  <div
                    className={`flex aspect-[16/10] flex-col justify-end gap-1.5 bg-gradient-to-br p-3 ${screen.accent}`}
                  >
                    <span className="h-1.5 w-3/5 rounded-full bg-white/70" />
                    <span className="h-1.5 w-2/5 rounded-full bg-white/40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-8">
          {STATS.map((stat, index) => (
            <div key={stat.label} className="flex items-center gap-8">
              {index > 0 && <span className="h-8 w-px bg-white/10" />}
              <div>
                <div className="text-xl font-bold tracking-tight text-white">{stat.value}</div>
                <div className="text-xs text-white/45">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
