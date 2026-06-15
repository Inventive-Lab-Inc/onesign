import type { Media, Website } from "@signage/types";

type ScheduleBounds = {
  display_from?: string | null;
  display_until?: string | null;
};

/** True when [now] is inside the schedule window; blank bounds mean always active. */
export function playbackScheduleIsActive(
  bounds: ScheduleBounds,
  at: Date = new Date(),
): boolean {
  const nowMs = at.getTime();
  if (bounds.display_from) {
    const startMs = Date.parse(bounds.display_from);
    if (!Number.isNaN(startMs) && nowMs < startMs) return false;
  }
  if (bounds.display_until) {
    const endMs = Date.parse(bounds.display_until);
    if (!Number.isNaN(endMs) && nowMs > endMs) return false;
  }
  return true;
}

export function mediaScheduleIsActive(media: Media, at: Date = new Date()): boolean {
  return playbackScheduleIsActive(media, at);
}

export function websiteScheduleIsActive(website: Website, at: Date = new Date()): boolean {
  return playbackScheduleIsActive(website, at);
}
