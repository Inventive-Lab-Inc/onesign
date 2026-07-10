import {
  CircleAlert,
  ImageOff,
  Moon,
  Pause,
  Power,
  ShieldAlert,
  TvMinimal,
  type LucideIcon,
} from "lucide-react";
import { Logo, LOGO_ACCENT } from "@/components/logo";
import { cn } from "@/lib/utils";

/** Matches Android SignageColors.ThemeShellDark */
export const TV_PLAYER_BG = "#012218";

/** Brand accent aligned with the OneSign TV logo tile. */
export const TV_PLAYER_ACCENT = LOGO_ACCENT;

type Scale = "card" | "full";

const scaleStyles: Record<
  Scale,
  {
    logoHeight: number;
    watermarkLogoHeight: number;
    bodyClass: string;
    hintClass: string;
    helperClass: string;
    badgeClass: string;
    deviceNameClass: string;
    errorCodeClass: string;
    actionClass: string;
  }
> = {
  card: {
    logoHeight: 28,
    watermarkLogoHeight: 18,
    bodyClass: "text-[0.65rem] leading-snug text-[#63AB97]",
    hintClass: "text-[0.58rem] leading-snug text-[#96BFB2]",
    helperClass: "text-[0.48rem] leading-snug text-[#96BFB2]/80",
    badgeClass: "text-[0.5rem] font-semibold uppercase tracking-[0.12em]",
    deviceNameClass: "text-[0.55rem] text-[#96BFB2]",
    errorCodeClass: "text-[0.5rem] font-medium tabular-nums text-white/35",
    actionClass: "text-[0.55rem] px-3 py-1.5",
  },
  full: {
    logoHeight: 52,
    watermarkLogoHeight: 28,
    bodyClass: "text-[2rem] font-medium leading-tight text-white",
    hintClass: "text-[1.375rem] leading-snug text-white/55",
    helperClass: "text-[1rem] leading-snug text-white/45",
    badgeClass: "text-[1.75rem] font-medium leading-snug",
    deviceNameClass: "text-[1.125rem] text-white/70",
    errorCodeClass: "text-[1rem] font-medium tabular-nums text-white/35",
    actionClass: "text-[1.25rem] px-10 py-3.5",
  },
};

/** OneSign TV lockup — same component as login, landing, and top nav. */
export function TvPlayerBrandHeader({
  scale = "card",
  className,
}: {
  scale?: Scale;
  className?: string;
}) {
  const styles = scaleStyles[scale];

  return (
    <div className={cn("flex shrink-0 justify-center", className)}>
      <Logo height={styles.logoHeight} tone="light" />
    </div>
  );
}

/** Pins the OneSign TV logo to the same top position on every branded screen. */
export function TvPlayerScreenShell({
  scale = "card",
  className,
  contentClassName,
  children,
}: {
  scale?: Scale;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col px-[6%] py-[3%] sm:px-[8%] sm:py-[5%]", className)}>
      <TvPlayerBrandHeader scale={scale} className="mb-[1.5vh] shrink-0" />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center overflow-hidden text-center",
          "justify-center",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function resolveStandbyIcon(badge?: string, message?: string): LucideIcon {
  const haystack = `${badge?.toLowerCase() ?? ""} ${message?.toLowerCase() ?? ""}`.trim();
  if (haystack.includes("screen disabled") || haystack.includes("playback disabled") || haystack === "off")
    return Power;
  if (haystack.includes("plan limit") || haystack === "paused") return Pause;
  if (haystack.includes("account suspended") || haystack === "suspended") return ShieldAlert;
  if (haystack.includes("off-hours")) return Moon;
  if (haystack === "empty") return ImageOff;
  if (haystack.includes("no playlist")) return TvMinimal;
  if (haystack.includes("can't start") || haystack.includes("can't connect")) return CircleAlert;
  return TvMinimal;
}

export function TvPlayerStandbyBadge({
  label,
  scale = "card",
  className,
}: {
  label: string;
  scale?: Scale;
  className?: string;
}) {
  const styles = scaleStyles[scale];
  const isFull = scale === "full";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border",
        isFull ? "border-transparent bg-transparent px-0 py-0 font-medium normal-case tracking-normal" : "px-2.5 py-0.5",
        styles.badgeClass,
        isFull ? "text-white" : undefined,
        className,
      )}
      style={
        isFull
          ? undefined
          : {
              borderColor: `${TV_PLAYER_ACCENT}59`,
              backgroundColor: `${TV_PLAYER_ACCENT}1a`,
              color: TV_PLAYER_ACCENT,
            }
      }
    >
      {label}
    </span>
  );
}

/** Standby screens — OneSign TV lockup plus status copy. */
export function TvPlayerBrandStandby({
  message,
  hint,
  badge,
  deviceName,
  errorCode,
  primaryAction,
  scale = "card",
  className,
}: {
  message?: string;
  hint?: string;
  badge?: string;
  deviceName?: string;
  errorCode?: string;
  primaryAction?: string;
  scale?: Scale;
  className?: string;
}) {
  const styles = scaleStyles[scale];
  const isFull = scale === "full";
  const StatusIcon = resolveStandbyIcon(badge, message);
  const iconSize = isFull ? "h-10 w-10" : "h-4 w-4";
  const iconWrap = isFull ? "h-20 w-20" : "h-9 w-9";

  return (
    <div className={cn("mx-auto w-full max-w-[80%]", className)}>
      <div className={cn("flex flex-col items-center", isFull ? "gap-5" : "gap-2")}>
        <div
          className={cn(
            "flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04]",
            iconWrap,
          )}
        >
          <StatusIcon className={cn(iconSize, "text-white/85")} strokeWidth={1.5} aria-hidden />
        </div>

        {badge ? <TvPlayerStandbyBadge label={badge} scale={scale} /> : null}
        {message ? <p className={cn("max-w-[90%]", styles.bodyClass)}>{message}</p> : null}

        {hint ? (
          <p
            className={cn(
              "max-w-[90%]",
              badge ? cn(isFull ? "mt-1" : "mt-0.5", styles.helperClass) : styles.hintClass,
            )}
          >
            {hint}
          </p>
        ) : null}

        {primaryAction ? (
          <div
            className={cn(
              "inline-flex rounded-md font-semibold text-[#F5FAF8]",
              isFull ? "mt-2" : "mt-1",
              styles.actionClass,
            )}
            style={{ backgroundColor: TV_PLAYER_ACCENT }}
          >
            {primaryAction}
          </div>
        ) : null}

        {errorCode ? (
          <p
            className={cn(
              "inline-flex rounded-md border border-white/10 bg-white/[0.04] px-3 py-1 font-mono",
              isFull ? "mt-2" : "mt-1",
              styles.errorCodeClass,
            )}
          >
            {errorCode}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export {
  formatTvPairingCode,
  normalizeTvPairingCode,
  TvPlayerPairingCode,
} from "@/components/tv-player/tv-player-pairing-code";

export function TvPlayerTrialWatermark({ scale = "card" }: { scale?: Scale }) {
  const styles = scaleStyles[scale];

  return (
    <div
      className={cn(
        "absolute bottom-[6%] right-[5%] opacity-45",
        scale === "full" ? "" : "scale-90",
      )}
    >
      <Logo height={styles.watermarkLogoHeight} tone="light" label="OneSign TV trial" />
    </div>
  );
}

/** Slide / playlist cache progress — matches Android SlideLoadProgressOverlay. */
export function TvPlayerLoadProgressOverlay({
  scale = "card",
  headline = "Caching…",
  percent = 42,
  subtitle,
}: {
  scale?: Scale;
  headline?: string;
  percent?: number | null;
  subtitle?: string;
}) {
  const isFull = scale === "full";
  const clampedPercent = percent == null ? null : Math.max(0, Math.min(100, percent));
  const ringSize = isFull ? 120 : 40;
  const stroke = isFull ? 4 : 2;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    clampedPercent == null ? circumference : circumference - (circumference * clampedPercent) / 100;

  return (
    <div className={cn("w-full text-center", isFull ? "max-w-md" : "max-w-[68%]")}>
      {clampedPercent != null ? (
        <div className="relative mx-auto" style={{ width: ringSize, height: ringSize }}>
          <svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={stroke}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="white"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <p
            className={cn(
              "absolute inset-0 flex items-center justify-center font-medium tabular-nums text-white",
              isFull ? "text-2xl" : "text-[0.55rem]",
            )}
          >
            {clampedPercent}%
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "mx-auto animate-spin rounded-full border-2 border-white/20 border-t-white",
            isFull ? "h-10 w-10" : "h-4 w-4",
          )}
        />
      )}
      <p
        className={cn(
          "text-white/55",
          isFull ? "mt-5 text-lg" : "mt-1.5 text-[0.5rem] leading-snug",
        )}
      >
        {headline}
      </p>
      {subtitle ? (
        <p
          className={cn(
            "text-white/40",
            isFull ? "mt-1 text-base" : "mt-0.5 text-[0.48rem] leading-snug",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
