import { toBlob } from "html-to-image";
import { getAppOrigin } from "@/lib/site-hosts";
import { getPlayerAccessToken } from "./player-supabase";

let lastHandledScreenshotRequestAt: string | null = null;
let captureInFlight = false;

export async function maybeCaptureLiveScreenshot(
  deviceId: string,
  screenshotRequestedAt: string | null | undefined,
  captureTarget: HTMLElement | null,
): Promise<boolean> {
  const requestedAt = screenshotRequestedAt?.trim();
  if (!requestedAt || requestedAt === lastHandledScreenshotRequestAt || !captureTarget) {
    return false;
  }
  if (captureInFlight) return false;

  captureInFlight = true;
  try {
    const blob = await toBlob(captureTarget, {
      cacheBust: true,
      pixelRatio: 1,
      type: "image/webp",
      quality: 0.85,
    });
    if (!blob) return false;

    const token = await getPlayerAccessToken();
    if (!token) return false;

    const formData = new FormData();
    formData.set("deviceId", deviceId);
    formData.set("file", new File([blob], "live.webp", { type: "image/webp" }));

    const base = getAppOrigin().replace(/\/$/, "");
    const response = await fetch(`${base}/api/devices/live-screenshot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (response.ok) {
      lastHandledScreenshotRequestAt = requestedAt;
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    captureInFlight = false;
  }
}

export function resetLiveScreenshotState(): void {
  lastHandledScreenshotRequestAt = null;
}
