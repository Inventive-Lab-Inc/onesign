"use client";

import type { MediaGroupWithMembers } from "@/lib/console-sync";
import { flattenMediaFolderTree } from "@/lib/media-folder-navigation";
import { FolderOpen, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MoveMediaToFolderDialog({
  open,
  onClose,
  mediaName,
  mediaCount = 1,
  folders,
  currentFolderId,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  mediaName: string;
  mediaCount?: number;
  folders: MediaGroupWithMembers[];
  currentFolderId?: string | null;
  onConfirm: (targetFolderId: string | null) => Promise<void>;
}) {
  const titleId = useId();
  const descId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const folderRows = useMemo(() => flattenMediaFolderTree(folders), [folders]);

  useEffect(() => {
    if (!open) return;
    setSelectedId(currentFolderId ?? null);
  }, [open, currentFolderId]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleConfirm() {
    setMoving(true);
    try {
      await onConfirm(selectedId);
      onClose();
    } finally {
      setMoving(false);
    }
  }

  if (!open) return null;

  const title = mediaCount > 1 ? `Move ${mediaCount} files` : "Move to folder";
  const description =
    mediaCount > 1
      ? "Pick a destination folder."
      : `Move “${mediaName}” to a folder, or choose None.`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 flex max-h-[min(90vh,480px)] w-full max-w-md flex-col rounded-xl border border-border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <p id={descId} className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <ul className="divide-y divide-border rounded-lg border border-border">
            <li>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                  selectedId === null ? "bg-brand-softest" : "hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  name="folder-target"
                  className="h-4 w-4 border-border"
                  checked={selectedId === null}
                  onChange={() => setSelectedId(null)}
                />
                <span className="text-sm text-foreground">None (ungrouped)</span>
              </label>
            </li>
            {folderRows.map(({ group, pathLabel }) => {
              const checked = selectedId === group.id;
              return (
                <li key={group.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                      checked ? "bg-brand-softest" : "hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="folder-target"
                      className="h-4 w-4 shrink-0 border-border"
                      checked={checked}
                      onChange={() => setSelectedId(group.id)}
                    />
                    <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 truncate text-sm text-foreground" title={pathLabel}>
                      {pathLabel}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {folders.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No folders yet. Create one from Content or File management.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={moving}>
            Cancel
          </Button>
          <Button type="button" disabled={moving} onClick={() => void handleConfirm()}>
            {moving ? "Moving…" : "Move"}
          </Button>
        </div>
      </div>
    </div>
  );
}
