"use client";

import { HardDrive, Monitor } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  deviceUsageRatio,
  deviceUsageTone,
  formatStorageBytes,
  formatStorageUsage,
  storageUsageRatio,
  storageUsageTone,
} from "@/lib/plan-quota";

type PlanUsageMeterProps = {
  variant: "screens" | "storage";
  used: number;
  limit: number;
  /** Compact row for tables; stacked single-unit "used/limit"; card for overview panels; inline for header center slots */
  layout?: "compact" | "stacked" | "card" | "inline";
  /** Extra content (e.g. an admin control) rendered inside the card layout. */
  footer?: ReactNode;
  className?: string;
};

const toneStyles = {
  ok: {
    track: "bg-brand-soft/40",
    fill: "bg-brand-strong",
    label: "text-brand-foreground-strong",
    badge: "bg-brand-soft text-brand-badge dark:text-brand-onDark",
  },
  warn: {
    track: "bg-amber-500/15",
    fill: "bg-amber-500",
    label: "text-amber-900 dark:text-amber-100",
    badge: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  },
  full: {
    track: "bg-red-500/12",
    fill: "bg-red-500",
    label: "text-red-800 dark:text-red-200",
    badge: "bg-red-500/12 text-red-800 dark:text-red-200",
  },
} as const;

function usageLabel(variant: PlanUsageMeterProps["variant"], used: number, limit: number): string {
  if (variant === "screens") {
    return `${used} of ${limit} screens`;
  }
  return `${formatStorageBytes(used)} of ${formatStorageBytes(limit)}`;
}

function statusMessage(variant: PlanUsageMeterProps["variant"], tone: keyof typeof toneStyles): string | null {
  if (tone === "ok") return null;
  if (tone === "warn") {
    return variant === "screens"
      ? "Approaching your screen limit"
      : "Storage almost full — delete unused files or request more space";
  }
  return variant === "screens"
    ? "Screen limit reached — remove a device or upgrade your plan"
    : "Storage full — delete files or request more space";
}

export function PlanUsageMeter({
  variant,
  used,
  limit,
  layout = "card",
  footer,
  className,
}: PlanUsageMeterProps) {
  const ratio =
    variant === "screens" ? deviceUsageRatio(used, limit) : storageUsageRatio(used, limit);
  const tone = variant === "screens" ? deviceUsageTone(ratio) : storageUsageTone(ratio);
  const styles = toneStyles[tone];
  const pct = Math.round(ratio * 100);
  const Icon = variant === "screens" ? Monitor : HardDrive;
  const title = variant === "screens" ? "Screens" : "Storage";
  const message = statusMessage(variant, tone);

  if (layout === "inline") {
    const shortUsed = formatStorageBytes(used);
    const shortLimit = formatStorageBytes(limit);
    const detail = `${title}: ${usageLabel(variant, used, limit)} (${pct}%)`;
    const showPct = tone !== "ok";

    return (
      <div
        className={cn(
          "inline-flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5",
          tone === "ok" && "border-border/60 bg-muted/20",
          tone === "warn" && "border-amber-500/25 bg-amber-500/8",
          tone === "full" && "border-red-500/25 bg-red-500/8",
          className,
        )}
        title={detail}
        role="group"
        aria-label={detail}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 truncate text-xs tabular-nums">
          <span className="font-medium text-foreground">{shortUsed}</span>
          <span className="text-muted-foreground"> / {shortLimit}</span>
        </span>
        <div
          className={cn("h-1 w-10 shrink-0 overflow-hidden rounded-full sm:w-12", styles.track)}
        >
          <div
            className={cn("h-full rounded-full transition-all duration-500 ease-out", styles.fill)}
            style={{ width: `${Math.max(pct, pct > 0 ? 10 : 0)}%` }}
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-label={detail}
          />
        </div>
        {showPct ? (
          <span className={cn("shrink-0 text-[0.6875rem] font-semibold tabular-nums", styles.label)}>
            {pct}%
          </span>
        ) : null}
      </div>
    );
  }

  if (layout === "stacked") {
    const value = variant === "screens" ? `${used}/${limit}` : formatStorageUsage(used, limit);

    return (
      <span
        className={cn(
          "whitespace-nowrap text-xs font-medium tabular-nums",
          tone === "ok" ? "text-foreground" : styles.label,
          className,
        )}
        title={`${title}: ${usageLabel(variant, used, limit)} (${pct}%)`}
      >
        {value}
      </span>
    );
  }

  if (layout === "compact") {
    const compactValue =
      variant === "screens"
        ? `${used}/${limit}`
        : `${formatStorageBytes(used)} / ${formatStorageBytes(limit)}`;

    return (
      <span
        className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums", className)}
        title={`${title}: ${usageLabel(variant, used, limit)} (${pct}%)`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn("font-medium", tone === "ok" ? "text-foreground" : styles.label)}>
          {compactValue}
        </span>
      </span>
    );
  }

  return (
    <article
      className={cn(
        "rounded-xl border border-border/80 bg-card p-3 shadow-sm",
        className,
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-background/90 p-1.5 shadow-sm ring-1 ring-border/60">
              <Icon className="h-3.5 w-3.5 text-brand-strong dark:text-brand-onDarkSoft" aria-hidden />
            </div>
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {title}
              </p>
              <p className={cn("text-sm font-semibold tabular-nums tracking-tight", styles.label)}>
                {usageLabel(variant, used, limit)}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
              styles.badge,
            )}
          >
            {pct}%
          </span>
        </div>

        <div className={cn("h-1.5 overflow-hidden rounded-full", styles.track)}>
          <div
            className={cn("h-full rounded-full transition-all duration-700 ease-out", styles.fill)}
            style={{ width: `${Math.max(pct, tone === "ok" && pct > 0 ? 4 : 0)}%` }}
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-label={`${title} usage`}
          />
        </div>

        {message ? (
          <p className={cn("text-xs leading-relaxed", styles.label)}>{message}</p>
        ) : footer ? null : (
          <p className="text-xs text-muted-foreground">
            {variant === "screens"
              ? "Linked TVs that count toward your plan."
              : "Images and videos stored in your cloud storage."}
          </p>
        )}

        {footer ? <div className="border-t border-border/70 pt-2.5">{footer}</div> : null}
      </div>
    </article>
  );
}

export function PlanUsageSummary({
  deviceCount,
  deviceLimit,
  storageUsedBytes,
  storageLimitBytes,
  className,
}: {
  deviceCount: number;
  deviceLimit: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  className?: string;
}) {
  return (
    <section
      className={cn("grid gap-3 sm:grid-cols-2", className)}
      aria-label="Plan usage"
    >
      <PlanUsageMeter variant="screens" used={deviceCount} limit={deviceLimit} />
      <PlanUsageMeter
        variant="storage"
        used={storageUsedBytes}
        limit={storageLimitBytes}
      />
    </section>
  );
}
