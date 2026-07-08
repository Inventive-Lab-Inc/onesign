import { mediaPublicUrl } from "@/lib/object-storage/urls";
import {
  clearCachedPlayback,
  manifestFromCache,
  readCachedPlayback,
  writeCachedPlayback,
} from "./cached-playback";
import { readPlaybackSecret, persistPlaybackSecret } from "./device-storage";
import { getPlayerSupabaseClient } from "./player-supabase";
import {
  normalizeScreenOrientation,
  parsePlaybackBlockReason,
  type PlaybackManifest,
  type PlaybackRevision,
  type PlaybackSlide,
  type TvPlaybackSlideRaw,
  type TvPlaybackSlidesResponse,
} from "./playback-types";

function mapSlide(raw: TvPlaybackSlideRaw): PlaybackSlide {
  const url =
    raw.fileType === "website" ? raw.storagePath : mediaPublicUrl(raw.storagePath);
  return {
    url,
    fileType: raw.fileType,
    durationSeconds: raw.durationSeconds ?? null,
    zoomLevel: raw.zoomLevel ?? null,
  };
}

function shuffleSlides(
  slides: PlaybackSlide[],
  shuffleEnabled: boolean,
  previous: PlaybackManifest | null,
  deviceId: string,
  contentRevision: string | null,
): PlaybackSlide[] {
  if (!shuffleEnabled || slides.length <= 1) return slides;

  if (
    previous &&
    previous.deviceId === deviceId &&
    previous.contentRevision === contentRevision &&
    previous.shuffleEnabled &&
    previous.slides.map((s) => s.url).sort().join("|") === slides.map((s) => s.url).sort().join("|")
  ) {
    return previous.slides;
  }

  const copy = [...slides];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

export async function fetchPlaybackRevision(deviceId: string): Promise<PlaybackRevision> {
  const supabase = getPlayerSupabaseClient();
  const playbackSecret = readPlaybackSecret();

  const { data, error } = await supabase.rpc("tv_get_playback_revision", {
    p_device_id: deviceId,
    p_playback_secret: playbackSecret,
  });

  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;
  if (raw.ok === false) {
    return {
      ok: false,
      deviceName: null,
      contentRevision: null,
      playlistId: null,
      playlistName: null,
      screenOrientation: "landscape",
      playbackDisabled: false,
      playbackBlockReason: null,
      showTrialWatermark: false,
      screenshotRequestedAt: null,
      playbackSecret: null,
    };
  }

  const secret = typeof raw.playbackSecret === "string" ? raw.playbackSecret : null;
  persistPlaybackSecret(secret);

  return {
    ok: true,
    deviceName: typeof raw.deviceName === "string" ? raw.deviceName : null,
    contentRevision: typeof raw.contentRevision === "string" ? raw.contentRevision : null,
    playlistId: typeof raw.playlistId === "string" ? raw.playlistId : null,
    playlistName: typeof raw.playlistName === "string" ? raw.playlistName : null,
    screenOrientation: normalizeScreenOrientation(
      typeof raw.screenOrientation === "string" ? raw.screenOrientation : null,
    ),
    playbackDisabled: raw.playbackDisabled === true,
    playbackBlockReason: parsePlaybackBlockReason(
      typeof raw.playbackBlockReason === "string" ? raw.playbackBlockReason : null,
    ),
    showTrialWatermark: raw.showTrialWatermark === true,
    screenshotRequestedAt:
      typeof raw.screenshotRequestedAt === "string" ? raw.screenshotRequestedAt : null,
    playbackSecret: secret,
  };
}

export async function fetchPlaybackSlides(
  deviceId: string,
  deviceNameFallback: string,
  previous: PlaybackManifest | null,
): Promise<PlaybackManifest | null> {
  const supabase = getPlayerSupabaseClient();
  const playbackSecret = readPlaybackSecret();

  const { data, error } = await supabase.rpc("tv_get_playback_slides", {
    p_device_id: deviceId,
    p_playback_secret: playbackSecret,
  });

  if (error) throw error;

  const res = (data ?? {}) as TvPlaybackSlidesResponse;
  if (!res.ok) {
    return null;
  }

  persistPlaybackSecret(res.playbackSecret ?? playbackSecret);

  const resolvedName = res.deviceName?.trim() || deviceNameFallback || "Display";
  const screenOrientation = normalizeScreenOrientation(
    (res as { screenOrientation?: string }).screenOrientation,
  );

  if (res.playbackDisabled) {
    clearCachedPlayback();
    return {
      deviceId,
      deviceName: resolvedName,
      playlistName: null,
      playlistId: null,
      slides: [],
      contentRevision: res.contentRevision ?? null,
      screenOrientation,
      transitionStyle: "none",
      shuffleEnabled: false,
      showTrialWatermark: res.showTrialWatermark ?? false,
      playbackDisabled: true,
      playbackBlockReason: parsePlaybackBlockReason(res.playbackBlockReason),
      outsideOperatingHours: res.outsideOperatingHours ?? false,
      blankWhenOffHours: res.blankWhenOffHours ?? false,
      isFromCache: false,
    };
  }

  const mapped = (res.slides ?? []).map(mapSlide);
  const slides = shuffleSlides(
    mapped,
    res.shuffleEnabled ?? false,
    previous,
    deviceId,
    res.contentRevision ?? null,
  );

  const manifest: PlaybackManifest = {
    deviceId,
    deviceName: resolvedName,
    playlistName: res.playlistName ?? null,
    playlistId: res.playlistId ?? null,
    slides,
    contentRevision: res.contentRevision ?? null,
    screenOrientation,
    transitionStyle: res.transitionStyle ?? "none",
    shuffleEnabled: res.shuffleEnabled ?? false,
    showTrialWatermark: res.showTrialWatermark ?? false,
    playbackDisabled: false,
    playbackBlockReason: null,
    outsideOperatingHours: res.outsideOperatingHours ?? false,
    blankWhenOffHours: res.blankWhenOffHours ?? false,
    isFromCache: false,
  };

  if (slides.length > 0) {
    writeCachedPlayback(manifest);
  } else {
    clearCachedPlayback();
  }

  return manifest;
}

export function loadCachedManifest(deviceId: string): PlaybackManifest | null {
  const cached = readCachedPlayback(deviceId);
  if (!cached) return null;
  return manifestFromCache(cached);
}

export async function sendDeviceHeartbeat(deviceId: string): Promise<void> {
  const supabase = getPlayerSupabaseClient();
  await supabase.rpc("tv_device_heartbeat", {
    p_device_id: deviceId,
    p_playback_secret: readPlaybackSecret(),
  });
}

export async function sendDeviceOffline(deviceId: string): Promise<void> {
  const supabase = getPlayerSupabaseClient();
  try {
    await supabase.rpc("tv_device_offline", {
      p_device_id: deviceId,
      p_playback_secret: readPlaybackSecret(),
    });
  } catch {
    // Best effort on tab close
  }
}
