"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useRouteNavigationPending } from "@/hooks/use-route-navigation-pending";
import { TopBar, type ProfilePortalSwitch } from "./top-bar";
import { SidebarNav } from "./top-nav";
import { useBreakpoint } from "./use-breakpoint";
import { useSettings } from "./settings-context";
import type { AppLayoutConfig, NavItem } from "./types";
import { assets, getBackgroundStyle } from "@/lib/config/assets";
import { PageContainer } from "./page-container";
import { TopBarActionSlotProvider } from "./top-bar-action-slot";

interface AppLayoutProps extends AppLayoutConfig {
  banner?: ReactNode;
  bottomNavItem?: NavItem;
  profileSubtext?: string;
  onSignOut?: () => void;
  portalSwitch?: ProfilePortalSwitch;
  getPageTitle?: (pathname: string) => string;
  topBarCenterSlot?: ReactNode;
  topBarRightSlot?: ReactNode;
  /** Shown before notifications (e.g. Sync). */
  topBarSyncControl?: ReactNode;
  userName?: string;
  languageLabel?: string;
  onLanguageClick?: () => void;
  children: ReactNode;
}

export function AppLayout({
  navItems,
  brand,
  getPageTitle = () => "",
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
  topBarSyncControl,
  userName,
  languageLabel,
  onLanguageClick,
  children,
}: AppLayoutProps) {
  const pathname = usePathname();
  const { pendingPath } = useRouteNavigationPending();
  const { isMobile } = useBreakpoint();
  const { settings, setSidebarCollapsed } = useSettings();
  const useSidebar = !isMobile && settings.layoutMode === "sidebar";
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setIsMobileNavOpen(false);
  }, [isMobile]);

  const isFullScreen = fullScreenPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const title = getPageTitle(pathname) || pathname || "App";
  const currentNavItem = navItems
    .filter((item) => {
      const end = item.end ?? item.path === "/";
      return end ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);
    })
    .sort((a, b) => b.path.length - a.path.length)[0];
  const titleIcon = currentNavItem?.icon;

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
            pendingPath={pendingPath}
            collapsed={settings.sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!settings.sidebarCollapsed)}
          />
        )}
        <TopBarActionSlotProvider>
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
            pendingPath={pendingPath}
            brand={brand}
            navItems={navItems}
            bottomNavItem={bottomNavItem}
            showNav={!useSidebar}
            mobileNavOpen={isMobileNavOpen}
            onMobileNavClose={() => setIsMobileNavOpen(false)}
            userName={userName}
            profileSubtext={profileSubtext}
            onSignOut={onSignOut}
            portalSwitch={portalSwitch}
            centerSlot={topBarCenterSlot}
            rightSlot={topBarRightSlot}
            syncControl={topBarSyncControl}
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
            <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
              <PageContainer className="pb-4">{children}</PageContainer>
            </main>
          </div>
        </div>
        </TopBarActionSlotProvider>
      </div>
    </div>
  );
}
