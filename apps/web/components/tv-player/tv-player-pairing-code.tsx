"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LOGO_ACCENT } from "@/components/logo";
import { deviceUiTvCopy as copy } from "@/lib/device-ui-copy";
import { cn } from "@/lib/utils";

type Scale = "card" | "full";

type TooltipPosition = { top: number; left: number };

const HOVER_TOOLTIP_MEDIA = "(hover: hover) and (pointer: fine)";

/** Normalizes input to exactly six digits (pads with trailing zeros). */
export function normalizeTvPairingCode(code: string): string {
  return code.replace(/\D/g, "").slice(0, 6).padEnd(6, "0");
}

/** Formats a six-digit pairing code with a space for screen-reader announcements. */
export function formatTvPairingCode(code: string): string {
  const digits = normalizeTvPairingCode(code);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function pairingCodeTooltipClassName(isFull: boolean): string {
  return cn(
    "pointer-events-none fixed z-50 inline-flex -translate-x-1/2 -translate-y-[calc(100%+0.75rem)] items-center gap-2 whitespace-nowrap rounded-md bg-white px-3 py-1.5 font-semibold text-[#012218] shadow-lg",
    isFull ? "text-[clamp(0.875rem,2.2vh,1.125rem)]" : "text-xs",
  );
}

function CopiedCheckIcon({ isFull }: { isFull: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        isFull ? "size-5" : "size-4",
      )}
      style={{ backgroundColor: LOGO_ACCENT }}
      aria-hidden
    >
      <Check
        className={cn("text-white", isFull ? "size-3 stroke-[3]" : "size-2.5 stroke-[3]")}
      />
    </span>
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

export function TvPlayerPairingCode({
  code,
  scale = "card",
  className,
}: {
  code: string;
  scale?: Scale;
  className?: string;
}) {
  const isFull = scale === "full";
  const rawCode = normalizeTvPairingCode(code);
  const groups = [rawCode.slice(0, 3), rawCode.slice(3)];
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const resetCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateTooltipPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(HOVER_TOOLTIP_MEDIA);
    const syncCanHover = () => setCanHover(mediaQuery.matches);
    syncCanHover();
    mediaQuery.addEventListener("change", syncCanHover);
    return () => mediaQuery.removeEventListener("change", syncCanHover);
  }, []);

  useEffect(() => {
    return () => {
      if (resetCopiedTimeoutRef.current) {
        clearTimeout(resetCopiedTimeoutRef.current);
      }
    };
  }, []);

  const showTooltip = copied || (canHover && hovered) || focused;
  const tooltipLabel = copied ? copy.pairing.copied : copy.pairing.clickToCopy;

  useEffect(() => {
    if (!showTooltip) {
      setTooltipPosition(null);
      return;
    }

    updateTooltipPosition();

    const handleLayoutChange = () => updateTooltipPosition();
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [showTooltip, updateTooltipPosition]);

  const handleCopy = useCallback(async () => {
    const selection = window.getSelection()?.toString() ?? "";
    if (selection.replace(/\D/g, "").length > 0) {
      return;
    }

    const didCopy = await copyTextToClipboard(rawCode);
    if (!didCopy) return;

    setCopied(true);
    updateTooltipPosition();
    if (resetCopiedTimeoutRef.current) {
      clearTimeout(resetCopiedTimeoutRef.current);
    }
    resetCopiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [rawCode, updateTooltipPosition]);

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      {showTooltip && tooltipPosition && typeof document !== "undefined"
        ? createPortal(
            <span
              role={copied ? "status" : "tooltip"}
              aria-live={copied ? "polite" : undefined}
              style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
              className={pairingCodeTooltipClassName(isFull)}
            >
              {copied ? <CopiedCheckIcon isFull={isFull} /> : null}
              {tooltipLabel}
            </span>,
            document.body,
          )
        : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleCopy}
        onMouseEnter={() => {
          setHovered(true);
          updateTooltipPosition();
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {
          setFocused(true);
          updateTooltipPosition();
        }}
        onBlur={() => setFocused(false)}
        aria-label={`Pairing code ${formatTvPairingCode(code)}. ${copy.pairing.clickToCopy}.`}
        className={cn(
          "inline-block cursor-pointer select-text border-0 bg-transparent p-0 text-left text-white",
          "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40",
        )}
      >
        <span
          className={cn(
            "font-semibold tabular-nums tracking-[0.08em]",
            isFull ? "text-[clamp(2rem,10vmin,4.5rem)] leading-none" : "text-[1.35rem] leading-none",
          )}
        >
          {groups[0]}
          <span className={cn(isFull ? "ml-[36px]" : "ml-1.5")}>{groups[1]}</span>
        </span>
      </button>
    </div>
  );
}
