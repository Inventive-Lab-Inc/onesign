"use client";

import { X } from "lucide-react";
import { useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConsoleCenterModal({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-10 flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
          size === "lg" ? "max-w-2xl" : "max-w-lg",
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? <span className="text-muted-foreground">{icon}</span> : null}
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
