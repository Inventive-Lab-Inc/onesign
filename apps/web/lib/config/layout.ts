import { Globe, Layers, LayoutDashboard, Monitor, Tv, type LucideIcon } from "lucide-react";
import type { AppLayoutConfig } from "@/components/shell/types";

export const layoutConfig: Omit<AppLayoutConfig, "getPageTitle" | "getPageIcon"> = {
  brand: {
    name: "OneSign",
    subtitle: "Console",
    icon: Tv,
    logoColor: "var(--theme)",
  },
  navItems: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/content", label: "Content", icon: Layers },
    { path: "/screens", label: "Screens", icon: Monitor, end: true },
    { path: "/groups", label: "Groups", icon: Tv, end: true },
    { path: "/websites", label: "Websites", icon: Globe, end: true },
  ],
};

export function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/screens": "Screens",
    "/groups": "Groups",
    "/content": "Content",
    "/websites": "Websites",
    "/account": "Account",
    "/profile": "My profile",
    "/download-app": "Download App",
  };
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith("/groups/")) return "Group";
  if (pathname.startsWith("/screens/")) return "Screen";
  if (pathname.startsWith("/content/calendar")) return "Schedule calendar";
  if (pathname.startsWith("/content/")) return "Content";
  if (pathname.startsWith("/websites/")) return "Website";
  return "App";
}

export function getPageIcon(pathname: string): LucideIcon | undefined {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return LayoutDashboard;
  if (pathname === "/screens" || pathname.startsWith("/screens/")) return Monitor;
  if (pathname === "/groups" || pathname.startsWith("/groups/")) return Tv;
  if (pathname === "/content" || pathname.startsWith("/content/")) return Layers;
  if (pathname === "/websites" || pathname.startsWith("/websites/")) return Globe;
  return undefined;
}
