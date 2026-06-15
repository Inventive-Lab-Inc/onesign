"use client";

import { useEffect, useId } from "react";
import { Button } from "@/components/ui/button";

interface MediaDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
}

export function MediaDeleteDialog({
  open,
  title,
  description,
  confirmLabel = "Delete file",
  onClose,
  onConfirm,
  isConfirming = false,
}: MediaDeleteDialogProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onClose} />
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
        <p id={descId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isConfirming} onClick={() => void onConfirm()}>
            {isConfirming ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
