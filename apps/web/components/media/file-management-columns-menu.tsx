"use client";

import { Columns3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FileManagementColumn = "title" | "type" | "uploaded" | "size";

const COLUMN_OPTIONS: { id: FileManagementColumn; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "type", label: "Type" },
  { id: "uploaded", label: "Uploaded" },
  { id: "size", label: "Size" },
];

export function FileManagementColumnsMenu({
  visibleColumns,
  onChange,
}: {
  visibleColumns: Set<FileManagementColumn>;
  onChange: (next: Set<FileManagementColumn>) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleColumn(column: FileManagementColumn) {
    const next = new Set(visibleColumns);
    if (next.has(column)) {
      if (next.size <= 1) return;
      next.delete(column);
    } else {
      next.add(column);
    }
    onChange(next);
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <Columns3 className="h-4 w-4" aria-hidden />
        Columns
      </Button>
      {open ? (
        <ul className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          {COLUMN_OPTIONS.map((option) => {
            const checked = visibleColumns.has(option.id);
            return (
              <li key={option.id}>
                <label
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted",
                    checked ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    className="h-4 w-4 rounded border-border"
                    onChange={() => toggleColumn(option.id)}
                  />
                  {option.label}
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
