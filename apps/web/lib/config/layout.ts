import { Globe, Layers, LayoutDashboard, Monitor, Tv } from "lucide-react";
import type { AppLayoutConfig } from "@/components/shell/types";

export const layoutConfig: Omit<AppLayoutConfig, "getPageTitle"> = {
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
    "/download-app": "Download App",
  };
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith("/groups/")) return "Group";
  if (pathname.startsWith("/screens/")) return "Screen";
  if (pathname.startsWith("/content/")) return "Content";
  if (pathname.startsWith("/websites/")) return "Website";
  return "App";
}
