"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type AdminClientRoutes = {
  clientId: string;
  basePath: string;
  overviewPath: string;
  devicesPath: string;
  devicePath: (deviceId: string) => string;
  groupsPath: string;
  playlistsPath: string;
  playlistPath: (playlistId: string) => string;
  mediaPath: string;
  auditPath: string;
};

const AdminClientRouteContext = createContext<AdminClientRoutes | null>(null);

export function AdminClientRouteProvider({
  clientId,
  children,
}: {
  clientId: string;
  children: ReactNode;
}) {
  const value = useMemo<AdminClientRoutes>(() => {
    const basePath = `/admin/clients/${clientId}`;
    return {
      clientId,
      basePath,
      overviewPath: basePath,
      devicesPath: `${basePath}/devices`,
      devicePath: (deviceId: string) => `${basePath}/devices/${deviceId}`,
      groupsPath: `${basePath}/groups`,
      playlistsPath: `${basePath}/playlists`,
      playlistPath: (playlistId: string) => `${basePath}/playlists/${playlistId}`,
      mediaPath: `${basePath}/playlists?view=library`,
      auditPath: `${basePath}/audit`,
    };
  }, [clientId]);

  return (
    <AdminClientRouteContext.Provider value={value}>{children}</AdminClientRouteContext.Provider>
  );
}

export function useAdminClientRoutes(): AdminClientRoutes | null {
  return useContext(AdminClientRouteContext);
}

export function devicesListPath(adminRoutes: AdminClientRoutes | null, groupId?: string | null): string {
  const base = adminRoutes?.devicesPath ?? "/devices";
  if (!groupId || groupId === "all") return base;
  return `${base}?group=${encodeURIComponent(groupId)}`;
}

export function groupsListPath(adminRoutes: AdminClientRoutes | null): string {
  return adminRoutes?.groupsPath ?? "/groups";
}

export function deviceDetailPath(
  deviceId: string,
  adminRoutes: AdminClientRoutes | null,
  groupId?: string | null,
): string {
  const base = adminRoutes?.devicePath(deviceId) ?? `/devices/${deviceId}`;
  if (!groupId || groupId === "all") return base;
  return `${base}?group=${encodeURIComponent(groupId)}`;
}

export function playlistsListPath(adminRoutes: AdminClientRoutes | null, groupId?: string | null): string {
  return contentPlaylistsPath(adminRoutes, groupId);
}

export function playlistDetailPath(
  playlistId: string,
  adminRoutes: AdminClientRoutes | null,
  groupId?: string | null,
): string {
  const base = adminRoutes?.playlistPath(playlistId) ?? `/playlists/${playlistId}`;
  if (!groupId || groupId === "all") return base;
  return `${base}?group=${encodeURIComponent(groupId)}`;
}

export type ContentView = "library" | "playlists";

export function contentLibraryPath(adminRoutes: AdminClientRoutes | null): string {
  const base = adminRoutes?.playlistsPath ?? "/playlists";
  return `${base}?view=library`;
}

export function contentPlaylistsPath(
  adminRoutes: AdminClientRoutes | null,
  groupId?: string | null,
): string {
  const base = adminRoutes?.playlistsPath ?? "/playlists";
  const params = new URLSearchParams();
  params.set("view", "playlists");
  if (groupId && groupId !== "all") {
    params.set("group", groupId);
  }
  return `${base}?${params.toString()}`;
}

export function parseContentView(searchParams: URLSearchParams): ContentView {
  return searchParams.get("view") === "library" ? "library" : "playlists";
}
