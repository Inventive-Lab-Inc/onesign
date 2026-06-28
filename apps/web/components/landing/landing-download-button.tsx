"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { appUrl } from "@/lib/site-hosts";
import { getReleasesPublicBaseUrl, releasePublicUrl } from "@/lib/object-storage/urls";

interface AppUpdateInfo {
  updateAvailable?: boolean;
  versionName?: string;
  storagePath?: string;
}

function apkDownloadName(versionName?: string): string {
  if (!versionName) return "onesign-tv.apk";
  return `onesign-tv-v${versionName.replace(/[^\w.-]+/g, "-")}.apk`;
}

/**
 * Resolves the latest active TV build via the anon-accessible `tv_check_app_update`
 * RPC so logged-out visitors can grab the APK directly. Falls back to the in-app
 * download page when no public release is configured.
 */
export function LandingDownloadButton({ className }: { className?: string }) {
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [versionName, setVersionName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!getReleasesPublicBaseUrl()) return;

    let cancelled = false;
    async function loadActiveRelease() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("tv_check_app_update", { p_version_code: 0 });
        if (cancelled || error || !data) return;
        const info = data as AppUpdateInfo;
        if (info.updateAvailable && info.storagePath) {
          setApkUrl(releasePublicUrl(info.storagePath));
          setVersionName(info.versionName);
        }
      } catch {
        // Leave the fallback link in place if the lookup fails.
      }
    }

    void loadActiveRelease();
    return () => {
      cancelled = true;
    };
  }, []);

  if (apkUrl) {
    return (
      <a href={apkUrl} download={apkDownloadName(versionName)} className={className}>
        <Download size={16} strokeWidth={2.5} />
        Download app
      </a>
    );
  }

  return (
    <a href={appUrl("/download-app")} className={className}>
      <Download size={16} strokeWidth={2.5} />
      Download app
    </a>
  );
}
