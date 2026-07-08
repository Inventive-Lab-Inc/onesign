import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export class PlaybackRealtimeCoordinator {
  private channel: RealtimeChannel | null = null;
  private subscribedDeviceId: string | null = null;
  private subscribedPlaylistId: string | null = null;

  update(
    supabase: SupabaseClient,
    deviceId: string,
    playlistId: string | null,
    onManifestMaybeStale: () => void,
  ): void {
    const pid = playlistId?.trim() || null;
    if (deviceId === this.subscribedDeviceId && pid === this.subscribedPlaylistId && this.channel) {
      return;
    }

    this.tearDown(supabase);

    this.subscribedDeviceId = deviceId;
    this.subscribedPlaylistId = pid;

    const channel = supabase.channel(`tv-manifest:${deviceId}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "device_playlists", filter: `device_id=eq.${deviceId}` },
      () => onManifestMaybeStale(),
    );

    if (pid) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlist_items", filter: `playlist_id=eq.${pid}` },
        () => onManifestMaybeStale(),
      );
    }

    channel.subscribe();
    this.channel = channel;
  }

  tearDown(supabase: SupabaseClient): void {
    if (this.channel) {
      void supabase.removeChannel(this.channel);
    }
    this.channel = null;
    this.subscribedDeviceId = null;
    this.subscribedPlaylistId = null;
  }
}
