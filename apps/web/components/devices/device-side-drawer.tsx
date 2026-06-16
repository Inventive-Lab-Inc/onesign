"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DRAWER_TRANSITION_MS = 230;

export function DeviceSideDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (visible || !present) return;
    const timer = window.setTimeout(() => setPresent(false), DRAWER_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [visible, present]);

  useEffect(() => {
    if (!present) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, onClose]);

  useEffect(() => {
    if (!present) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [present]);

  if (!present || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity motion-reduce:transition-none",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: `${DRAWER_TRANSITION_MS}ms` }}
        aria-label="Dismiss"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed inset-y-0 right-0 flex h-dvh max-h-dvh w-full max-w-md flex-col border-l border-border bg-card shadow-xl",
          "transition-transform motion-reduce:transition-none motion-reduce:translate-x-0",
          visible ? "translate-x-0" : "translate-x-full",
          className,
        )}
        style={{ transitionDuration: `${DRAWER_TRANSITION_MS}ms`, transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div> : null}
      </aside>
    </div>,
    document.body,
  );
}
