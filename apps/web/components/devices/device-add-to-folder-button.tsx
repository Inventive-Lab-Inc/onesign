"use client";

import type { DeviceGroupWithMembers } from "@/lib/console-sync";
import { resolveGroupColor } from "@/lib/device-group-colors";
import { cn } from "@/lib/utils";
import { FolderInput, FolderPlus } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

const MENU_MIN_WIDTH = 176;
const MENU_ESTIMATED_HEIGHT = 240;
const VIEWPORT_PAD = 8;
const MENU_GAP = 6;

type DeviceAddToFolderButtonProps = {
  deviceName: string;
  folders: DeviceGroupWithMembers[];
  onAddToFolder: (groupId: string) => void;
  onCreateFolder?: () => void;
  layout?: "list" | "grid";
  className?: string;
};

type MenuPlacement = "above" | "below";

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
  placement: MenuPlacement;
};

function resolveMenuPosition(
  trigger: HTMLElement,
  menuHeight: number,
  preferred: MenuPlacement,
): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const menuWidth = MENU_MIN_WIDTH;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceAbove = rect.top - VIEWPORT_PAD;
  const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PAD;

  let placement = preferred;
  if (preferred === "above" && spaceAbove < menuHeight && spaceBelow > spaceAbove) {
    placement = "below";
  } else if (preferred === "below" && spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    placement = "above";
  }

  const top = placement === "below" ? rect.bottom + MENU_GAP : rect.top - MENU_GAP;

  let left = rect.left;
  if (left + menuWidth > viewportWidth - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, rect.right - menuWidth);
  }
  left = Math.max(VIEWPORT_PAD, left);

  return {
    top,
    left,
    minWidth: Math.max(rect.width, MENU_MIN_WIDTH),
    placement,
  };
}

function menuPositionStyle(position: MenuPosition): React.CSSProperties {
  return {
    top: position.top,
    left: position.left,
    minWidth: position.minWidth,
    transform: position.placement === "above" ? "translateY(-100%)" : undefined,
  };
}

export function DeviceAddToFolderButton({
  deviceName,
  folders,
  onAddToFolder,
  onCreateFolder,
  layout = "list",
  className,
}: DeviceAddToFolderButtonProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );

  const preferredPlacement: MenuPlacement = layout === "grid" ? "above" : "below";

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    function updatePosition() {
      if (!triggerRef.current) return;
      const measuredHeight = menuRef.current?.offsetHeight ?? MENU_ESTIMATED_HEIGHT;
      setMenuPosition(resolveMenuPosition(triggerRef.current, measuredHeight, preferredPlacement));
    }

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, preferredPlacement, sortedFolders.length, onCreateFolder]);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pickFolder(groupId: string) {
    onAddToFolder(groupId);
    setOpen(false);
  }

  function openCreateFolder() {
    setOpen(false);
    onCreateFolder?.();
  }

  function toggleMenu(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!open && triggerRef.current) {
      setMenuPosition(
        resolveMenuPosition(triggerRef.current, MENU_ESTIMATED_HEIGHT, preferredPlacement),
      );
    }
    setOpen((value) => !value);
  }

  const triggerProps = {
    ref: triggerRef,
    type: "button" as const,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": menuId,
    title: "Add to folder",
    "aria-label": `Add ${deviceName} to folder`,
    onClick: toggleMenu,
  };

  const menu =
    open && mounted && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Choose a folder"
            className="fixed z-[200] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg"
            style={menuPositionStyle(menuPosition)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {sortedFolders.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No folders yet.</div>
            ) : (
              <ul className="max-h-52 overflow-y-auto">
                {sortedFolders.map((folder) => (
                  <li key={folder.id}>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                      onClick={() => pickFolder(folder.id)}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: resolveGroupColor(folder.accent_color) }}
                        aria-hidden
                      />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {onCreateFolder ? (
              <button
                type="button"
                role="menuitem"
                className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-border px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={openCreateFolder}
              >
                <FolderPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Create folder
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  if (layout === "grid") {
    return (
      <div className={cn(className)}>
        <button
          {...triggerProps}
          className="device-screen-card__btn device-screen-card__btn--folder"
        >
          <FolderInput className="h-3.5 w-3.5" aria-hidden />
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <Button
        {...triggerProps}
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 px-2.5 text-xs font-medium"
      >
        <FolderInput className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden xl:inline">Add to folder</span>
      </Button>
      {menu}
    </div>
  );
}
