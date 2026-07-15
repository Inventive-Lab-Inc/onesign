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
    ring: string;
    track: string;
    iconSurface: string;
    iconColor: string;
    barTrack: string;
    caption: string;
  }
> = {
  ok: {
    fill: "bg-[var(--dashboard-brand)]",
    label: "text-[var(--dashboard-brand)]",
    ring: "stroke-[var(--dashboard-brand)]",
    track: "stroke-[var(--dashboard-brand)]/20",
    iconSurface: "bg-[var(--dashboard-brand-soft)]",
    iconColor: "text-[var(--dashboard-brand)]",
    barTrack: "bg-[var(--dashboard-brand-muted)]",
    caption: "text-muted-foreground",
  },
  warn: {
    fill: "dashboard-usage-bar--warn",
    label: "text-amber-800 dark:text-amber-200",
    ring: "dashboard-usage-ring--warn",
    track: "stroke-amber-500/20",
    iconSurface: "bg-amber-500/12",
    iconColor: "text-amber-700 dark:text-amber-300",
    barTrack: "bg-amber-500/15",
    caption: "text-amber-800 dark:text-amber-200",
  },
  full: {
    fill: "dashboard-usage-bar--full",
    label: "text-orange-800 dark:text-orange-200",
    ring: "dashboard-usage-ring--full",
    track: "stroke-orange-500/20",
    iconSurface: "bg-orange-500/12",
    iconColor: "text-orange-700 dark:text-orange-300",
    barTrack: "bg-orange-500/15",
    caption: "text-orange-800 dark:text-orange-200",
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
    <div className="relative h-[4.75rem] w-[4.75rem] shrink-0" aria-hidden>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="5" className={styles.track} />
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
        <span className={cn("text-base font-bold tabular-nums tracking-tight", styles.label)}>
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
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
      aria-label={`${title} usage ${valueLabel}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                styles.iconSurface,
              )}
            >
              <Icon className={cn("h-5 w-5", styles.iconColor)} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className={cn("text-[0.625rem] font-bold uppercase tracking-[0.14em]", styles.label)}>
                {title}
              </p>
              <p className="text-xl font-bold tabular-nums leading-tight tracking-tight text-foreground sm:text-[1.375rem]">
                {valueLabel}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className={cn("h-1.5 overflow-hidden rounded-full", styles.barTrack)}>
              <motion.div
                className={cn("h-full rounded-full", styles.fill)}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                transition={{ duration: 0.75, delay: 0.1 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                role="progressbar"
                aria-valuenow={used}
                aria-valuemin={0}
                aria-valuemax={limit}
              />
            </div>
            <p className={cn("text-xs leading-relaxed", warning ? cn("font-medium", styles.caption) : styles.caption)}>
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
  variant: "primary" | "soft";
  live: boolean;
  index: number;
  reduceMotion: boolean;
}) {
  const isLiveOnline = variant === "primary" && live && count > 0;
  const isMutedOnline = variant === "primary" && live && count === 0;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        href={href}
        className={cn(
          "group flex h-full min-h-[4.75rem] items-center gap-3.5 rounded-2xl border p-4 shadow-sm transition-[box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dashboard-brand)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-4 sm:p-5",
          isLiveOnline && "dashboard-online-card--live border-transparent",
          isMutedOnline && "dashboard-online-card--muted",
          variant === "soft" && "border-border/80 bg-card",
        )}
      >
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            isLiveOnline && "bg-white text-[var(--dashboard-brand)]",
            isMutedOnline && "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
            variant === "soft" && "bg-[var(--dashboard-brand-soft)] text-[var(--dashboard-brand)]",
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p
              className={cn(
                "text-base font-bold leading-tight tracking-tight",
                isLiveOnline ? "text-white" : "text-foreground",
              )}
            >
              {label}
            </p>
            {live ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold tracking-wide",
                  isLiveOnline && "bg-white/90 text-[var(--dashboard-brand)]",
                  isMutedOnline && "border border-border/70 bg-muted/50 text-muted-foreground",
                )}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {isLiveOnline ? (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--dashboard-brand)] opacity-45" />
                  ) : null}
                  <span
                    className={cn(
                      "relative inline-flex h-1.5 w-1.5 rounded-full",
                      isLiveOnline ? "bg-[var(--dashboard-brand)]" : "bg-muted-foreground/50",
                    )}
                  />
                </span>
                Live
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-0.5 text-xs leading-snug",
              isLiveOnline ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        </div>

        <p
          className={cn(
            "shrink-0 self-center text-4xl font-bold tabular-nums leading-none tracking-tight",
            isLiveOnline && "text-white",
            isMutedOnline && "text-red-600 dark:text-red-400",
            variant === "soft" && "text-foreground",
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
    <section className="space-y-4" aria-label="Usage and limits">
      <div>
        <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Your plan
        </p>
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Usage & limits</h2>
      </div>

      <div
        className={cn(
          "grid gap-4",
          showPlanUsage ? "lg:grid-cols-2 lg:items-stretch lg:gap-5" : "grid-cols-1",
        )}
      >
        {showPlanUsage ? (
          <div className="flex flex-col gap-4">
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
        ) : null}

        <div className={cn("flex flex-col gap-3", !showPlanUsage && "sm:grid sm:grid-cols-3 sm:gap-4")}>
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
      </div>
    </section>
  );
}
