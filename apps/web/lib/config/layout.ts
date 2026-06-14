import { Layers, LayoutDashboard, Monitor, Tv, Users } from "lucide-react";
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
    { path: "/devices", label: "Screens", icon: Monitor, end: true },
    { path: "/groups", label: "Groups", icon: Users, end: true },
    { path: "/playlists", label: "Content", icon: Layers, end: false },
  ],
};

export function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/devices": "Screens",
    "/groups": "Groups",
    "/playlists": "Content",
    "/media": "Content",
    "/account": "Account",
    "/download-app": "Download App",
  };
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith("/devices/")) return "Screen";
  if (pathname.startsWith("/playlists/")) return "Playlist";
  return "App";
}
