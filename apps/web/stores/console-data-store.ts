import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Media, Playlist, PlaylistItemWithMedia, Website } from "@signage/types";
import type { ConsoleSnapshot, DeviceGroupWithMembers, DeviceWithAssignments, MediaGroupWithMembers, PlaylistGroupWithMembers } from "@/lib/console-sync";

export type { DeviceWithAssignments, MediaGroupWithMembers, PlaylistGroupWithMembers };

type ConsoleDataState = {
  ownerId: string | null;
  workspaceId: string | null;
  devices: DeviceWithAssignments[];
  deviceGroups: DeviceGroupWithMembers[];
  playlistGroups: PlaylistGroupWithMembers[];
  mediaGroups: MediaGroupWithMembers[];
  playlists: Playlist[];
  media: Media[];
  websites: Website[];
  playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
  websitePlaylistRefCounts: Record<string, number>;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  syncError: string | null;
};

type ConsoleDataActions = {
  setOwnerId: (id: string | null) => void;
  setWorkspaceId: (id: string | null) => void;
  applySnapshot: (
    ownerId: string,
    workspaceId: string | null,
    snapshot: ConsoleSnapshot,
    syncedAt: number,
  ) => void;
  patchDevice: (deviceId: string, patch: Partial<DeviceWithAssignments>) => void;
  patchMedia: (mediaId: string, patch: Partial<Media>) => void;
  patchWebsite: (websiteId: string, patch: Partial<Website>) => void;
  setSyncing: (v: boolean) => void;
  setSyncError: (msg: string | null) => void;
  reset: () => void;
};

const emptyState = (): ConsoleDataState => ({
  ownerId: null,
  workspaceId: null,
  devices: [],
  deviceGroups: [],
  playlistGroups: [],
  mediaGroups: [],
  playlists: [],
  media: [],
  websites: [],
  playlistItemsByPlaylistId: {},
  websitePlaylistRefCounts: {},
  lastSyncedAt: null,
  isSyncing: false,
  syncError: null,
});

export const useConsoleDataStore = create<ConsoleDataState & ConsoleDataActions>()(
  persist(
    (set) => ({
      ...emptyState(),
      setOwnerId: (ownerId) => set((s) => (s.ownerId === ownerId ? s : { ownerId })),
      setWorkspaceId: (workspaceId) => set((s) => (s.workspaceId === workspaceId ? s : { workspaceId })),
      applySnapshot: (ownerId, workspaceId, snapshot, syncedAt) =>
        set({
          ownerId,
          workspaceId,
          devices: snapshot.devices,
          deviceGroups: snapshot.deviceGroups,
          playlistGroups: snapshot.playlistGroups,
          mediaGroups: snapshot.mediaGroups,
          playlists: snapshot.playlists,
          media: snapshot.media,
          websites: snapshot.websites,
          playlistItemsByPlaylistId: snapshot.playlistItemsByPlaylistId,
          websitePlaylistRefCounts: snapshot.websitePlaylistRefCounts,
          lastSyncedAt: syncedAt,
          syncError: null,
        }),
      patchDevice: (deviceId, patch) =>
        set((s) => {
          const index = s.devices.findIndex((device) => device.id === deviceId);
          if (index < 0) return s;
          const device = s.devices[index]!;
          let changed = false;
          for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
            if (device[key] !== patch[key]) {
              changed = true;
              break;
            }
          }
          if (!changed) return s;
          const devices = s.devices.slice();
          devices[index] = { ...device, ...patch };
          return { devices };
        }),
      patchMedia: (mediaId, patch) =>
        set((s) => {
          const index = s.media.findIndex((item) => item.id === mediaId);
          if (index < 0) return s;
          const item = s.media[index]!;
          let changed = false;
          for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
            if (item[key] !== patch[key]) {
              changed = true;
              break;
            }
          }
          if (!changed) return s;

          const nextMediaItem = { ...item, ...patch };
          const nextMedia = s.media.slice();
          nextMedia[index] = nextMediaItem;

          const nextPlaylistItems: Record<string, PlaylistItemWithMedia[]> = {};
          for (const [playlistId, items] of Object.entries(s.playlistItemsByPlaylistId)) {
            nextPlaylistItems[playlistId] = items.map((playlistItem) =>
              playlistItem.media_id === mediaId && playlistItem.media
                ? { ...playlistItem, media: { ...playlistItem.media, ...patch } }
                : playlistItem,
            );
          }

          return {
            media: nextMedia,
            playlistItemsByPlaylistId: nextPlaylistItems,
          };
        }),
      patchWebsite: (websiteId, patch) =>
        set((s) => {
          const existingWebsite = s.websites.find((website) => website.id === websiteId);
          if (existingWebsite) {
            let websiteChanged = false;
            for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
              if (existingWebsite[key] !== patch[key]) {
                websiteChanged = true;
                break;
              }
            }
            if (!websiteChanged) return s;
          }

          const nextWebsite = <W extends { id: string }>(website: W): W =>
            website.id === websiteId ? { ...website, ...patch } : website;
          const nextPlaylistItems: Record<string, PlaylistItemWithMedia[]> = {};
          for (const [playlistId, items] of Object.entries(s.playlistItemsByPlaylistId)) {
            nextPlaylistItems[playlistId] = items.map((item) =>
              item.website_id === websiteId && item.website
                ? { ...item, website: nextWebsite(item.website) }
                : item,
            );
          }
          return {
            websites: s.websites.map(nextWebsite),
            playlistItemsByPlaylistId: nextPlaylistItems,
          };
        }),
      setSyncing: (isSyncing) => set({ isSyncing }),
      setSyncError: (syncError) => set({ syncError }),
      reset: () => set(emptyState()),
    }),
    {
      name: "signage-console-cache-v6",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        ownerId: s.ownerId,
        workspaceId: s.workspaceId,
        devices: s.devices,
        deviceGroups: s.deviceGroups,
        playlistGroups: s.playlistGroups,
        mediaGroups: s.mediaGroups,
        playlists: s.playlists,
        media: s.media,
        websites: s.websites,
        playlistItemsByPlaylistId: s.playlistItemsByPlaylistId,
        websitePlaylistRefCounts: s.websitePlaylistRefCounts,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
);

export function clearConsoleCachePersist() {
  useConsoleDataStore.getState().reset();
  try {
    localStorage.removeItem("signage-console-cache-v6");
    localStorage.removeItem("signage-console-cache-v5");
    localStorage.removeItem("signage-console-cache-v4");
    localStorage.removeItem("signage-console-cache-v3");
    localStorage.removeItem("signage-console-cache-v2");
    localStorage.removeItem("signage-console-cache-v1");
  } catch {
    /* ignore */
  }
}
