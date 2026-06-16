import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Media, Playlist, PlaylistItemWithMedia, Website } from "@signage/types";
import type { ConsoleSnapshot, DeviceGroupWithMembers, DeviceWithAssignments, MediaGroupWithMembers, PlaylistGroupWithMembers } from "@/lib/console-sync";

export type { DeviceWithAssignments, MediaGroupWithMembers, PlaylistGroupWithMembers };

type ConsoleDataState = {
  ownerId: string | null;
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
  applySnapshot: (ownerId: string, snapshot: ConsoleSnapshot, syncedAt: number) => void;
  patchDevice: (deviceId: string, patch: Partial<DeviceWithAssignments>) => void;
  patchMedia: (mediaId: string, patch: Partial<Media>) => void;
  patchWebsite: (websiteId: string, patch: Partial<Website>) => void;
  setSyncing: (v: boolean) => void;
  setSyncError: (msg: string | null) => void;
  reset: () => void;
};

const emptyState = (): ConsoleDataState => ({
  ownerId: null,
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
      setOwnerId: (ownerId) => set({ ownerId }),
      applySnapshot: (ownerId, snapshot, syncedAt) =>
        set({
          ownerId,
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
        set((s) => ({
          devices: s.devices.map((device) =>
            device.id === deviceId ? { ...device, ...patch } : device,
          ),
        })),
      patchMedia: (mediaId, patch) =>
        set((s) => ({
          media: s.media.map((item) => (item.id === mediaId ? { ...item, ...patch } : item)),
        })),
      patchWebsite: (websiteId, patch) =>
        set((s) => {
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
      name: "signage-console-cache-v5",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        ownerId: s.ownerId,
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
    localStorage.removeItem("signage-console-cache-v5");
    localStorage.removeItem("signage-console-cache-v4");
    localStorage.removeItem("signage-console-cache-v3");
    localStorage.removeItem("signage-console-cache-v2");
    localStorage.removeItem("signage-console-cache-v1");
  } catch {
    /* ignore */
  }
}
