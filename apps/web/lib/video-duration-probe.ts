/** Whole seconds for integer DB columns; rejects bogus sub-second probe noise. */
export function durationSecondsForStorage(seconds: number | null | undefined): number | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 1) return null;
  return Math.max(1, Math.round(seconds));
}

function isWebmUrl(url: string): boolean {
  const path = url.split("#")[0]?.split("?")[0] ?? url;
  return /\.webm$/i.test(path);
}

/** Best-effort length from element state after metadata or seek. */
function readVideoLengthSeconds(video: HTMLVideoElement): number | null {
  const candidates: number[] = [];

  if (video.seekable.length > 0) {
    const end = video.seekable.end(video.seekable.length - 1);
    if (Number.isFinite(end) && end >= 1) candidates.push(end);
  }

  const d = video.duration;
  if (Number.isFinite(d) && d >= 1 && d !== Number.POSITIVE_INFINITY) {
    candidates.push(d);
  }

  const t = video.currentTime;
  if (Number.isFinite(t) && t >= 1) candidates.push(t);

  if (candidates.length === 0) return null;
  return durationSecondsForStorage(Math.max(...candidates));
}

function probeVideoUrlOnce(url: string, crossOrigin: "" | "anonymous"): Promise<number | null> {
  const src = url.split("#")[0] ?? url;
  const mustSeekToEnd = isWebmUrl(src);

  return new Promise<number | null>((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    if (crossOrigin) video.crossOrigin = crossOrigin;

    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const seekToEnd = () => {
      const onSeeked = () => {
        const afterSeek = readVideoLengthSeconds(video);
        if (afterSeek != null) {
          finish(afterSeek);
          return;
        }
        window.setTimeout(() => finish(readVideoLengthSeconds(video)), 200);
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      try {
        const target =
          video.seekable.length > 0
            ? video.seekable.end(video.seekable.length - 1)
            : Number.MAX_SAFE_INTEGER;
        video.currentTime = target;
      } catch {
        finish(null);
      }
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        if (mustSeekToEnd) {
          seekToEnd();
          return;
        }

        const fromMeta = readVideoLengthSeconds(video);
        if (fromMeta != null) {
          finish(fromMeta);
          return;
        }

        if (
          video.duration === Number.POSITIVE_INFINITY ||
          Number.isNaN(video.duration) ||
          video.seekable.length === 0
        ) {
          seekToEnd();
          return;
        }

        finish(null);
      },
      { once: true },
    );

    video.addEventListener("error", () => finish(null), { once: true });

    const timer = window.setTimeout(() => {
      if (settled) return;
      const last = readVideoLengthSeconds(video);
      if (last != null) finish(last);
      else if (video.readyState >= 1) seekToEnd();
      else finish(null);
    }, 45_000);

    video.src = src;
    video.load();
  });
}

/**
 * Browser-only: read intrinsic length from a video URL (public storage, blob, etc.).
 * WebM screen captures always use seek-to-end; never trust early metadata alone.
 */
export async function probeVideoUrlDurationSeconds(url: string): Promise<number | null> {
  if (typeof document === "undefined") return null;
  const plain = await probeVideoUrlOnce(url, "");
  if (plain != null) return plain;
  return probeVideoUrlOnce(url, "anonymous");
}

/** Probe duration from a local File (upload flow). */
export async function probeVideoFileDurationSeconds(file: File): Promise<number | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(file);
  try {
    return await probeVideoUrlDurationSeconds(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
