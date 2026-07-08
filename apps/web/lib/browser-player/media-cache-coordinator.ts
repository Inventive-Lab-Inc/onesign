import type { PlaybackSlide } from "./playback-types";

export type MediaCacheProgressState = {
  headline: string;
  percent: number | null;
};

const CACHE_NAME = "onesign-player-media-v1";

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

function mediaFileLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").filter(Boolean).pop();
    return segment ?? "media";
  } catch {
    return "media";
  }
}

export class MediaCacheCoordinator {
  private activeRevision: string | null = null;
  private warming = false;
  private progress: MediaCacheProgressState | null = null;
  private onProgressChanged: (state: MediaCacheProgressState | null) => void;

  constructor(onProgressChanged: (state: MediaCacheProgressState | null) => void) {
    this.onProgressChanged = onProgressChanged;
  }

  isWarming(): boolean {
    return this.warming;
  }

  getProgress(): MediaCacheProgressState | null {
    return this.progress;
  }

  onPlaybackActive(slides: PlaybackSlide[], contentRevision: string | null, startIndex: number): void {
    if (slides.length === 0) {
      this.publishProgress(null);
      return;
    }

    const revisionKey = contentRevision?.trim() || slides.map((s) => s.url).join("|");
    if (revisionKey === this.activeRevision) {
      return;
    }
    this.activeRevision = revisionKey;
    void this.warmPlaylist(slides, startIndex);
  }

  private publishProgress(state: MediaCacheProgressState | null): void {
    this.progress = state;
    this.onProgressChanged(state);
  }

  private async warmPlaylist(slides: PlaybackSlide[], startIndex: number): Promise<void> {
    if (this.warming) return;
    this.warming = true;

    const n = slides.length;
    const order: number[] = [];
    for (let offset = 0; offset < n; offset += 1) {
      order.push((startIndex + offset) % n);
    }

    const urls = order
      .map((index) => slides[index]!)
      .filter((slide) => slide.fileType === "image" || slide.fileType === "video")
      .map((slide) => slide.url)
      .filter(Boolean);

    const total = urls.length;
    if (total === 0) {
      this.warming = false;
      this.publishProgress(null);
      return;
    }

    let completed = 0;
    for (const url of urls) {
      this.publishProgress({
        headline: `Caching ${mediaFileLabel(url)}…`,
        percent: Math.round((completed / total) * 100),
      });

      await this.warmUrl(url);
      completed += 1;
    }

    this.warming = false;
    this.publishProgress(null);
  }

  private async warmUrl(url: string): Promise<void> {
    const cache = await openCache();
    if (!cache) return;

    try {
      const existing = await cache.match(url);
      if (existing) return;
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (response.ok) {
        await cache.put(url, response.clone());
      }
    } catch {
      // Best-effort prefetch
    }
  }

  snapshot(slides: PlaybackSlide[], contentRevision: string | null): Record<string, unknown> | null {
    if (slides.length === 0) return null;
    return {
      revision: contentRevision,
      slideCount: slides.length,
      warming: this.warming,
      imageCount: slides.filter((s) => s.fileType === "image").length,
      videoCount: slides.filter((s) => s.fileType === "video").length,
    };
  }
}

export function videoUrlsToWarm(currentIndex: number, slides: PlaybackSlide[]): string[] {
  if (slides.length === 0) return [];
  const n = slides.length;
  const current = slides[currentIndex % n];
  const next = slides[(currentIndex + 1) % n];
  const urls: string[] = [];
  if (current?.fileType === "video" && current.url) urls.push(current.url);
  if (next?.fileType === "video" && next.url && next.url !== current?.url) urls.push(next.url);
  return urls;
}

export function imageUrlsToWarm(currentIndex: number, slides: PlaybackSlide[]): string[] {
  if (slides.length === 0) return [];
  const n = slides.length;
  const current = slides[currentIndex % n];
  const next = slides[(currentIndex + 1) % n];
  const urls: string[] = [];
  if (current?.fileType === "image" && current.url) urls.push(current.url);
  if (next?.fileType === "image" && next.url && next.url !== current?.url) urls.push(next.url);
  return urls;
}
