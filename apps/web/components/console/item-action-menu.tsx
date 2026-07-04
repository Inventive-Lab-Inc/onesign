"use client";

import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ActionMenuItem = {
  label: string;
  description?: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  /** Shown as a tooltip when the item is disabled (e.g. missing permission). */
  disabledReason?: string;
  separatorBefore?: boolean;
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
      className="min-w-[12rem] w-max max-w-[min(100vw-1rem,24rem)] overflow-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;

        const classNames = cn(
          "flex w-full gap-2 px-3 py-2 text-left text-sm transition-colors",
          item.description ? "items-start" : "items-center",
          isFirst && "rounded-t-lg",
          isLast && "rounded-b-lg",
          item.disabled
            ? "cursor-not-allowed text-muted-foreground/60"
            : item.destructive
              ? "text-red-600 hover:bg-red-600 hover:text-white hover:[&_svg]:stroke-white hover:[&_svg]:text-white"
              : "text-foreground hover:bg-muted",
        );

        const content = item.description ? (
          <>
            {item.icon ? <span className="shrink-0 self-start pt-0.5">{item.icon}</span> : null}
            <span className="min-w-0">
              <span className="block whitespace-nowrap font-medium leading-snug">{item.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{item.description}</span>
            </span>
          </>
        ) : (
          <>
            {item.icon}
            <span className="whitespace-nowrap">{item.label}</span>
          </>
        );

        const baseNode =
          item.href && !item.disabled ? (
            <Link
              href={item.href}
              role="menuitem"
              className={classNames}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            >
              {content}
            </Link>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              // pointer-events-none lets the wrapping tooltip receive hover when disabled.
              className={cn(classNames, item.disabled && item.disabledReason && "pointer-events-none")}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (item.disabled) return;
                setOpen(false);
                item.onClick?.();
              }}
            >
              {content}
            </button>
          );

        const itemNode =
          item.disabled && item.disabledReason ? (
            <Tooltip
              label={item.disabledReason}
              className="w-full cursor-not-allowed"
              placement="right"
              multiline
            >
              {baseNode}
            </Tooltip>
          ) : (
            baseNode
          );

        return (
          <li key={`${item.label}-${index}`} role="none">
            {item.separatorBefore && index > 0 ? (
              <div className="my-1 border-t border-border" role="separator" aria-hidden />
            ) : null}
            {itemNode}
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
