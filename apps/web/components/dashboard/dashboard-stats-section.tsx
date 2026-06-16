"use client";

import {
  deviceUsageRatio,
  deviceUsageTone,
  formatStorageBytes,
  storageUsageRatio,
  storageUsageTone,
} from "@/lib/plan-quota";
import { cn } from "@/lib/utils";
import { Globe, HardDrive, Image as ImageIcon, Monitor } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

type UsageTone = "ok" | "warn" | "full";

const toneStyles: Record<
  UsageTone,
  {
    fill: string;
    label: string;
    badge: string;
    ring: string;
    track: string;
    iconSurface: string;
    iconColor: string;
    barTrack: string;
  }
> = {
  ok: {
    fill: "bg-brand",
    label: "text-brand-strong",
    badge: "bg-brand-soft text-brand-strong",
    ring: "stroke-brand",
    track: "stroke-brand-faint25",
    iconSurface: "bg-brand-soft",
    iconColor: "text-brand-strong",
    barTrack: "bg-brand-soft",
  },
  warn: {
    fill: "dashboard-usage-bar--warn",
    label: "text-amber-800 dark:text-amber-200",
    badge: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
    ring: "dashboard-usage-ring--warn",
    track: "stroke-amber-500/20",
    iconSurface: "bg-amber-500/12",
    iconColor: "text-amber-700 dark:text-amber-300",
    barTrack: "bg-amber-500/15",
  },
  full: {
    fill: "dashboard-usage-bar--full",
    label: "text-orange-800 dark:text-orange-200",
    badge: "bg-orange-500/15 text-orange-900 dark:text-orange-100",
    ring: "dashboard-usage-ring--full",
    track: "stroke-orange-500/20",
    iconSurface: "bg-orange-500/12",
    iconColor: "text-orange-700 dark:text-orange-300",
    barTrack: "bg-orange-500/15",
  },
};

function CircularProgress({
  pct,
  tone,
  label,
}: {
  pct: number;
  tone: UsageTone;
  label: string;
}) {
  const styles = toneStyles[tone];
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative h-[5rem] w-[5rem] shrink-0" aria-hidden>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="5"
          className={styles.track}
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("fill-none transition-[stroke-dashoffset] duration-700 ease-out", styles.ring)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-lg font-bold tabular-nums tracking-tight", styles.label)}>
          {pct}%
        </span>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

function UsageCard({
  variant,
  used,
  limit,
  index,
  reduceMotion,
}: {
  variant: "screens" | "storage";
  used: number;
  limit: number;
  index: number;
  reduceMotion: boolean;
}) {
  const ratio =
    variant === "screens" ? deviceUsageRatio(used, limit) : storageUsageRatio(used, limit);
  const tone =
    variant === "screens" ? deviceUsageTone(ratio) : storageUsageTone(ratio);
  const styles = toneStyles[tone];
  const pct = Math.round(ratio * 100);
  const Icon = variant === "screens" ? Monitor : HardDrive;
  const title = variant === "screens" ? "Screens" : "Storage";
  const valueLabel =
    variant === "screens"
      ? `${used} of ${limit} screens`
      : `${formatStorageBytes(used)} of ${formatStorageBytes(limit)}`;
  const description =
    variant === "screens"
      ? "Linked TVs that count toward your plan."
      : "Images and videos stored in your cloud storage.";
  const warning =
    tone === "warn"
      ? variant === "screens"
        ? "Approaching your screen limit"
        : "Storage almost full"
      : tone === "full"
        ? variant === "screens"
          ? "Screen limit reached"
          : "Storage full"
        : null;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm"
      aria-label={`${title} usage ${valueLabel}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3.5">
          <div className="flex items-center gap-3.5">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                styles.iconSurface,
              )}
            >
              <Icon className={cn("h-6 w-6", styles.iconColor)} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {title}
              </p>
              <p
                className={cn(
                  "text-[1.375rem] font-bold tabular-nums leading-tight tracking-tight sm:text-2xl",
                  styles.label,
                )}
              >
                {valueLabel}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className={cn("h-2.5 overflow-hidden rounded-full", styles.barTrack)}>
              <motion.div
                className={cn("h-full rounded-full", styles.fill)}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                transition={{ duration: 0.8, delay: 0.12 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                role="progressbar"
                aria-valuenow={used}
                aria-valuemin={0}
                aria-valuemax={limit}
              />
            </div>
            <p
              className={cn(
                "text-[0.6875rem] leading-relaxed",
                warning ? cn("font-medium", styles.label) : "text-muted-foreground",
              )}
            >
              {warning ?? description}
            </p>
          </div>
        </div>

        <CircularProgress pct={pct} tone={tone} label={`${title} ${pct}%`} />
      </div>
    </motion.article>
  );
}

const countCards = [
  {
    key: "online",
    href: "/screens",
    label: "Online",
    description: "Screens reachable now",
    icon: Globe,
    variant: "primary" as const,
    live: true,
  },
  {
    key: "screens",
    href: "/screens",
    label: "Screens",
    description: "Linked TV players",
    icon: Monitor,
    variant: "soft" as const,
    live: false,
  },
  {
    key: "content",
    href: "/content",
    label: "Content",
    description: "Files in cloud storage",
    icon: ImageIcon,
    variant: "soft" as const,
    live: false,
  },
] as const;

const countCardStyles = {
  primary: {
    surface: "dashboard-online-card--live",
    iconSurface: "bg-white text-[var(--dashboard-brand)]",
    label: "text-white",
    description: "text-white/65",
    count: "text-white",
    liveBadge: "bg-emerald-400 text-[var(--dashboard-brand)] font-bold shadow-sm",
    liveDot: "bg-[var(--dashboard-brand)]",
  },
  primaryMuted: {
    surface: "dashboard-online-card--muted",
    iconSurface: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    label: "text-foreground",
    description: "text-muted-foreground",
    count: "text-red-600 dark:text-red-400",
    liveBadge: "border border-border/70 bg-muted/50 text-muted-foreground",
    liveDot: "bg-muted-foreground/50",
  },
  soft: {
    surface: "border-border/80 bg-card",
    iconSurface: "bg-[var(--dashboard-brand)] text-white",
    label: "text-foreground",
    description: "text-muted-foreground",
    count: "text-[var(--dashboard-brand)]",
    liveBadge: "bg-brand-soft text-brand-strong",
    liveDot: "bg-brand",
  },
} as const;

function CountCard({
  href,
  label,
  description,
  count,
  icon: Icon,
  variant,
  live,
  index,
  reduceMotion,
}: {
  href: string;
  label: string;
  description: string;
  count: number;
  icon: typeof Globe;
  variant: keyof typeof countCardStyles | "primary";
  live: boolean;
  index: number;
  reduceMotion: boolean;
}) {
  const isMutedOnline = variant === "primary" && live && count === 0;
  const styleKey = isMutedOnline ? "primaryMuted" : variant === "primary" ? "primary" : "soft";
  const styles = countCardStyles[styleKey];

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        href={href}
        className={cn(
          "group flex h-full min-h-[8rem] items-center gap-4 rounded-2xl border p-6 shadow-sm transition-[box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-faint30 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-5",
          styles.surface,
        )}
      >
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full sm:h-16 sm:w-16",
            styles.iconSurface,
          )}
        >
          <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn("text-xl font-bold leading-tight tracking-tight sm:text-[1.375rem]", styles.label)}>
              {label}
            </p>
            {live ? (
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-wide",
                  styles.liveBadge,
                )}
              >
                <span className="relative flex h-2 w-2">
                  {!isMutedOnline ? (
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-50",
                        styles.liveDot,
                      )}
                    />
                  ) : null}
                  <span className={cn("relative inline-flex h-2 w-2 rounded-full", styles.liveDot)} />
                </span>
                Live
              </span>
            ) : null}
          </div>
          <p className={cn("mt-1.5 text-[0.6875rem] leading-snug", styles.description)}>{description}</p>
        </div>

        <p
          className={cn(
            "shrink-0 self-center text-5xl font-bold tabular-nums leading-none tracking-tight sm:text-6xl",
            styles.count,
          )}
        >
          {count}
        </p>
      </Link>
    </motion.div>
  );
}

export function DashboardStatsSection({
  deviceCount,
  deviceLimit,
  storageUsedBytes,
  storageLimitBytes,
  onlineCount,
  mediaCount,
  showPlanUsage = true,
}: {
  deviceCount: number;
  deviceLimit: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  onlineCount: number;
  mediaCount: number;
  showPlanUsage?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const counts = {
    online: onlineCount,
    screens: deviceCount,
    content: mediaCount,
  };

  return (
    <section className="space-y-6" aria-label="Dashboard overview">
      {showPlanUsage ? (
        <div className="space-y-3">
          <div>
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Your plan
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Usage & limits</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <UsageCard
              variant="screens"
              used={deviceCount}
              limit={deviceLimit}
              index={0}
              reduceMotion={!!reduceMotion}
            />
            <UsageCard
              variant="storage"
              used={storageUsedBytes}
              limit={storageLimitBytes}
              index={1}
              reduceMotion={!!reduceMotion}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {countCards.map((card, index) => (
          <CountCard
            key={card.key}
            href={card.href}
            label={card.label}
            description={card.description}
            count={counts[card.key as keyof typeof counts]}
            icon={card.icon}
            variant={card.variant}
            live={card.live}
            index={index}
            reduceMotion={!!reduceMotion}
          />
        ))}
      </div>
    </section>
  );
}
