"use client";

import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 0;
    const menuWidth = menu?.offsetWidth ?? 168;
    const gap = 4;
    const viewportPadding = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = menuHeight > 0 && spaceBelow < menuHeight + gap && rect.top > menuHeight + gap;

    let top = openUp ? rect.top - menuHeight - gap : rect.bottom + gap;
    let left = rect.right - menuWidth;

    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - menuWidth - viewportPadding));
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - menuHeight - viewportPadding));

    setMenuStyle({
      position: "fixed",
      top,
      left,
      zIndex: 50,
      visibility: "visible",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    requestAnimationFrame(updatePosition);
  }, [open, updatePosition, items.length]);

  useEffect(() => {
    if (!open) return;
    function onScroll() {
      updatePosition();
    }
    function onResize() {
      updatePosition();
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const menu = open ? (
    <ul
      ref={menuRef}
      role="menu"
      style={menuStyle}
      className="min-w-[10.5rem] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
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
  ) : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
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
      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
