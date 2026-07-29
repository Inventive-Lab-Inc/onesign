import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getReleasesPublicBaseUrl, releasePublicUrl } from "@/lib/object-storage/urls";
import { getSupabaseConnectEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AppUpdateInfo {
  updateAvailable?: boolean;
  storagePath?: string;
}

/**
 * Short public download link: https://onesigntv.com/apk
 * Always 302s to the currently active TV APK in MinIO.
 */
export async function GET() {
  const releasesBase = getReleasesPublicBaseUrl();
  if (!releasesBase) {
    return new NextResponse("APK downloads are not configured.", { status: 503 });
  }

  const connect = getSupabaseConnectEnv();
  if (!connect) {
    return new NextResponse("Server configuration error.", { status: 500 });
  }

  const supabase = createClient(connect.url, connect.anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("tv_check_app_update", {
    p_version_code: 0,
  });

  if (error) {
    return new NextResponse("Could not resolve the latest app release.", { status: 502 });
  }

  const info = data as AppUpdateInfo | null;
  if (!info?.updateAvailable || !info.storagePath) {
    return new NextResponse("No active app release is available.", { status: 404 });
  }

  return NextResponse.redirect(releasePublicUrl(info.storagePath), {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
