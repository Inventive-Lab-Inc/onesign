"use client";

import { useEffect, useId } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  confirmingLabel?: string;
  confirmVariant?: ButtonProps["variant"];
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "Continue",
  confirmingLabel = "Working…",
  confirmVariant = "default",
  onClose,
  onConfirm,
  isConfirming = false,
}: ConfirmActionDialogProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isConfirming) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isConfirming]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Dismiss"
        onClick={() => !isConfirming && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <div id={descId} className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={() => void onConfirm()}
            disabled={isConfirming}
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
