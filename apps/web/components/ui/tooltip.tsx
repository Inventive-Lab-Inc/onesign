"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type TooltipPosition = { top: number; left: number };

type TooltipPlacement = "top" | "right";

/** Horizontal gap kept between the cursor/trigger and the tooltip. */
const CURSOR_GAP = 14;

/**
 * Minimal hover/focus tooltip rendered through a portal so it is never clipped
 * by ancestors with `overflow: hidden` (e.g. scrollable tables).
 *
 * `placement="right"` pins the tooltip to the right of the pointer (falling back
 * to the right of the trigger for keyboard focus). `multiline` lets longer
 * messages wrap instead of forcing a single line.
 */
export function Tooltip({
  label,
  children,
  className,
  placement = "top",
  multiline = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  placement?: TooltipPlacement;
  multiline?: boolean;
}) {
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const [position, setPosition] = React.useState<TooltipPosition | null>(null);

  const positionFromCursor = React.useCallback((event: React.MouseEvent) => {
    if (placement === "right") {
      setPosition({ top: event.clientY, left: event.clientX + CURSOR_GAP });
      return;
    }
    const trigger = triggerRef.current?.firstElementChild ?? triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({ top: rect.top, left: rect.left + rect.width / 2 });
  }, [placement]);

  const showFromFocus = React.useCallback(() => {
    const trigger = triggerRef.current?.firstElementChild ?? triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    if (placement === "right") {
      setPosition({ top: rect.top + rect.height / 2, left: rect.right + CURSOR_GAP });
      return;
    }
    setPosition({ top: rect.top, left: rect.left + rect.width / 2 });
  }, [placement]);

  const hide = React.useCallback(() => setPosition(null), []);

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      onMouseEnter={positionFromCursor}
      onMouseMove={placement === "right" ? positionFromCursor : undefined}
      onMouseLeave={hide}
      onFocusCapture={showFromFocus}
      onBlurCapture={hide}
    >
      {children}
      {position && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{ top: position.top, left: position.left }}
              className={cn(
                "pointer-events-none fixed z-50 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md",
                placement === "right" ? "-translate-y-1/2" : "-translate-x-1/2 -translate-y-[calc(100%+0.5rem)]",
                multiline ? "max-w-[15rem] whitespace-pre-line leading-snug" : "whitespace-nowrap",
              )}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
