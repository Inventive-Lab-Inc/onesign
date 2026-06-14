"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type AdminClientRoutes = {
  clientId: string;
  basePath: string;
  overviewPath: string;
  devicesPath: string;
  devicePath: (deviceId: string) => string;
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
      playlistsPath: `${basePath}/playlists`,
      playlistPath: (playlistId: string) => `${basePath}/playlists/${playlistId}`,
      mediaPath: `${basePath}/media`,
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
  const base = adminRoutes?.playlistsPath ?? "/playlists";
  if (!groupId || groupId === "all") return base;
  return `${base}?group=${encodeURIComponent(groupId)}`;
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
