"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type TooltipPosition = { top: number; left: number };

/**
 * Minimal hover/focus tooltip rendered through a portal so it is never clipped
 * by ancestors with `overflow: hidden` (e.g. scrollable tables).
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const [position, setPosition] = React.useState<TooltipPosition | null>(null);

  const show = React.useCallback(() => {
    const trigger = triggerRef.current?.firstElementChild ?? triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({ top: rect.top, left: rect.left + rect.width / 2 });
  }, []);

  const hide = React.useCallback(() => setPosition(null), []);

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {position && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{ top: position.top, left: position.left }}
              className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
