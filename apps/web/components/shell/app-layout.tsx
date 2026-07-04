"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useRouteNavigationPending } from "@/hooks/use-route-navigation-pending";
import { TopBar, type ProfilePortalSwitch } from "./top-bar";
import { SidebarNav } from "./top-nav";
import { useBreakpoint } from "./use-breakpoint";
import { useSettings } from "./settings-context";
import type { LucideIcon } from "lucide-react";
import type { AppLayoutConfig, NavItem } from "./types";
import { assets, getBackgroundStyle } from "@/lib/config/assets";
import { PageContainer } from "./page-container";

interface AppLayoutProps extends AppLayoutConfig {
  banner?: ReactNode;
  bottomNavItem?: NavItem;
  profileSubtext?: string;
  onSignOut?: () => void;
  portalSwitch?: ProfilePortalSwitch;
  getPageTitle?: (pathname: string) => string;
  getPageIcon?: (pathname: string) => LucideIcon | undefined;
  topBarCenterSlot?: ReactNode;
  topBarRightSlot?: ReactNode;
  /** Shown immediately to the left of the profile button (e.g. workspace switcher). */
  topBarProfileLeadingSlot?: ReactNode;
  userName?: string;
  languageLabel?: string;
  onLanguageClick?: () => void;
  children: ReactNode;
}

export function AppLayout({
  navItems,
  brand,
  getPageTitle = () => "",
  getPageIcon,
  fullScreenPaths = [],
  fontFamily = 'var(--font-sans)',
  outerBg = "#1A3C6E",
  contentCardBg = "#F4F7FB",
  banner,
  bottomNavItem,
  profileSubtext,
  onSignOut,
  portalSwitch,
  topBarCenterSlot,
  topBarRightSlot,
  topBarProfileLeadingSlot,
  userName,
  languageLabel,
  onLanguageClick,
  children,
}: AppLayoutProps) {
  const pathname = usePathname();
  const { optimisticPath } = useRouteNavigationPending();
  const displayPath = optimisticPath ?? pathname;
  const { isMobile } = useBreakpoint();
  const { settings, setSidebarCollapsed } = useSettings();
  const useSidebar = !isMobile;
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setIsMobileNavOpen(false);
  }, [isMobile]);

  const isFullScreen = fullScreenPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const title = getPageTitle(displayPath) || displayPath || "App";
  const currentNavItem = navItems
    .filter((item) => {
      const end = item.end ?? item.path === "/";
      return end ? displayPath === item.path : displayPath === item.path || displayPath.startsWith(`${item.path}/`);
    })
    .sort((a, b) => b.path.length - a.path.length)[0];
  const titleIcon = getPageIcon?.(displayPath) ?? currentNavItem?.icon;

  if (isFullScreen) {
    return (
      <div
        className="dashboard-shell-root"
        style={{
          fontFamily,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {banner}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  const outerStyle = {
    fontFamily,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    ...getBackgroundStyle(assets.layoutBackgroundValue || outerBg),
  } as const;

  return (
    <div className="dashboard-shell-root" style={outerStyle}>
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          padding: isMobile ? 0 : "0.5rem",
          gap: useSidebar ? "0.5rem" : 0,
        }}
      >
        {useSidebar && (
          <SidebarNav
            brand={brand}
            navItems={navItems}
            bottomNavItem={bottomNavItem}
            optimisticPath={optimisticPath}
            collapsed={settings.sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!settings.sidebarCollapsed)}
          />
        )}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 0 : "0.5rem",
          }}
        >
          {banner}
          <TopBar
            title={title}
            titleIcon={titleIcon}
            optimisticPath={optimisticPath}
            brand={brand}
            navItems={navItems}
            bottomNavItem={bottomNavItem}
            mobileNavOpen={isMobileNavOpen}
            onMobileNavClose={() => setIsMobileNavOpen(false)}
            userName={userName}
            profileSubtext={profileSubtext}
            onSignOut={onSignOut}
            portalSwitch={portalSwitch}
            centerSlot={topBarCenterSlot}
            rightSlot={topBarRightSlot}
            profileLeadingSlot={topBarProfileLeadingSlot}
            languageLabel={languageLabel}
            onLanguageClick={onLanguageClick}
            onMobileMenuOpen={() => setIsMobileNavOpen(true)}
            isMobile={isMobile}
          />
          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: contentCardBg,
              borderRadius: isMobile ? 0 : "0.75rem",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
              <PageContainer className="pb-4">{children}</PageContainer>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
