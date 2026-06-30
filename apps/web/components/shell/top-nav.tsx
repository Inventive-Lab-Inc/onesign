"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAppRouter } from "@/hooks/use-app-router";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Logo } from "@/components/logo";
import type { BrandConfig, NavItem } from "./types";

const HOME_PATH = "/dashboard";
const NAV_ICON_STROKE = 1.75;

function navMatches(path: string, pathname: string, end?: boolean): boolean {
  const useEnd = end ?? path === "/";
  if (useEnd) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export const SIDEBAR_WIDTH = "15rem";
export const SIDEBAR_COLLAPSED_WIDTH = "4rem";

interface SidebarNavProps {
  brand: BrandConfig;
  navItems: NavItem[];
  bottomNavItem?: NavItem;
  optimisticPath?: string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/** Persistent left sidebar navigation for the desktop "sidebar" layout mode. */
export function SidebarNav({
  brand,
  navItems,
  bottomNavItem,
  optimisticPath,
  collapsed = false,
  onToggleCollapse,
}: SidebarNavProps) {
  const pathname = usePathname();
  const displayPath = optimisticPath ?? pathname;
  const { name, icon: BrandIcon, logoColor = "var(--theme)" } = brand;
  const items = useMemo(
    () => (bottomNavItem ? [...navItems, bottomNavItem] : navItems),
    [navItems, bottomNavItem],
  );

  const rowStyle = (active: boolean) =>
    ({
      display: "flex",
      flexDirection: collapsed ? "column" : "row",
      alignItems: "center",
      justifyContent: collapsed ? "center" : "flex-start",
      gap: collapsed ? "0.25rem" : "0.625rem",
      width: collapsed ? "100%" : undefined,
      minWidth: collapsed ? 0 : undefined,
      boxSizing: "border-box",
      padding: collapsed ? "0.5rem 0" : "0.625rem 0.75rem",
      borderRadius: "0.5rem",
      textDecoration: "none",
      fontSize: "0.8125rem",
      fontWeight: active ? 600 : 500,
      color: active ? "#fff" : "rgba(255,255,255,0.72)",
      background: active ? logoColor : "transparent",
      transition: "color 0.15s, background 0.15s",
      whiteSpace: collapsed ? "normal" : "nowrap",
      overflow: "hidden",
    }) as const;

  return (
    <aside
      style={{
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: collapsed ? "0.5rem 0" : "0.5rem 0.25rem 0.5rem 0.5rem",
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      aria-label="Sidebar"
    >
      <Link
        prefetch
        href={HOME_PATH}
        title={collapsed ? name : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: "0.5rem",
          textDecoration: "none",
          width: collapsed ? "100%" : undefined,
          padding: collapsed ? "0.375rem 0" : "0.375rem 0.5rem",
          flexShrink: 0,
        }}
      >
        {collapsed ? (
          <BrandMark icon={BrandIcon} logoColor={logoColor} iconSize={18} />
        ) : (
          <Logo height={26} tone="light" />
        )}
      </Link>
      <div
        style={{
          height: "0.0625rem",
          background: "rgba(255,255,255,0.12)",
          margin: collapsed ? "0.5rem 0 0.625rem" : "0.5rem 0.5rem 0.625rem",
          flexShrink: 0,
        }}
        aria-hidden
      />
      <nav
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: collapsed ? "stretch" : undefined,
          gap: "0.1875rem",
          scrollbarWidth: "none",
          width: "100%",
        }}
        className="top-nav-scroll"
        aria-label="Main"
      >
        {items.map((item) => {
          const { icon: Icon, label, path, end } = item;
          const active = navMatches(path, displayPath, end ?? path === "/");
          return (
            <Link prefetch key={path} href={path} style={rowStyle(active)} title={label}>
              <span
                style={{
                  position: "relative",
                  width: 18,
                  height: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} strokeWidth={NAV_ICON_STROKE} />
              </span>
              {collapsed ? (
                <span
                  style={{
                    fontSize: "0.5625rem",
                    fontWeight: active ? 600 : 500,
                    lineHeight: 1.1,
                    width: "100%",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label}
                </span>
              ) : (
                label
              )}
            </Link>
          );
        })}
      </nav>
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            marginTop: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "0.625rem",
            width: collapsed ? "100%" : undefined,
            padding: collapsed ? "0.5rem 0" : "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              flexShrink: 0,
            }}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} strokeWidth={NAV_ICON_STROKE} />
            ) : (
              <PanelLeftClose size={18} strokeWidth={NAV_ICON_STROKE} />
            )}
          </span>
          {!collapsed && "Collapse"}
        </button>
      )}
    </aside>
  );
}

interface MobileNavDrawerProps {
  brand: BrandConfig;
  navItems: NavItem[];
  bottomNavItem?: NavItem;
  open: boolean;
  onClose: () => void;
  optimisticPath?: string | null;
}

export function MobileNavDrawer({ brand, navItems, bottomNavItem, open, onClose, optimisticPath }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const displayPath = optimisticPath ?? pathname;
  const router = useAppRouter();
  const { name, logoColor = "var(--theme)" } = brand;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const rowStyle = (active: boolean) =>
    ({
      display: "flex",
      alignItems: "center",
      gap: "0.625rem",
      padding: "0.625rem 0.875rem",
      borderRadius: "0.5rem",
      textDecoration: "none",
      fontSize: "0.875rem",
      fontWeight: active ? 600 : 500,
      color: active ? "#fff" : "rgba(255,255,255,0.72)",
      background: active ? logoColor : "transparent",
    }) as const;

  return (
    <>
      <div
        onClick={onClose}
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 49,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: "min(18.5rem, 88vw)",
          zIndex: 50,
          background: "var(--theme-shell-dark)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: open ? "0.25rem 0 1.5rem rgba(0,0,0,0.35)" : "none",
        }}
        aria-hidden={!open}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.875rem 1rem",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              router.push(HOME_PATH);
              onClose();
            }}
            aria-label={name}
            style={{
              display: "flex",
              alignItems: "center",
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: 0,
              textAlign: "left",
            }}
          >
            <Logo height={26} tone="light" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "0.4375rem",
              border: "0.0625rem solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div style={{ height: "0.0625rem", background: "rgba(255,255,255,0.1)", marginInline: "1rem" }} />
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
          aria-label="Main"
        >
          {navItems.map((item) => {
            const { icon: Icon, label, path, end } = item;
            const active = navMatches(path, displayPath, end ?? path === "/");
            return (
              <Link prefetch key={path} href={path} style={rowStyle(active)} onClick={onClose}>
                <Icon size={18} strokeWidth={NAV_ICON_STROKE} style={{ flexShrink: 0 }} />
                {label}
              </Link>
            );
          })}
          {bottomNavItem && (
            <Link
              prefetch
              href={bottomNavItem.path}
              style={rowStyle(
                navMatches(bottomNavItem.path, displayPath, bottomNavItem.end ?? bottomNavItem.path === "/"),
              )}
              onClick={onClose}
            >
              <bottomNavItem.icon size={18} strokeWidth={NAV_ICON_STROKE} style={{ flexShrink: 0 }} />
              {bottomNavItem.label}
            </Link>
          )}
        </nav>
      </aside>
    </>
  );
}
