"use client";

import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ActionMenuItem = {
  label: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
};

export function ItemActionMenu({
  items,
  ariaLabel,
  className,
}: {
  items: ActionMenuItem[];
  ariaLabel: string;
  className?: string;
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

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[10.5rem] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {items.map((item) => {
            const classNames = cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
              item.disabled
                ? "cursor-not-allowed text-muted-foreground/60"
                : item.destructive
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-muted",
            );

            if (item.href && !item.disabled) {
              return (
                <li key={item.label} role="none">
                  <Link
                    href={item.href}
                    role="menuitem"
                    className={classNames}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(false);
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={classNames}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (item.disabled) return;
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
