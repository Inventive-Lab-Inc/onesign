import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConnectEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const connect = getSupabaseConnectEnv();
  if (!connect) {
    return new NextResponse("Server configuration error", { status: 500 });
  }

  const supabase = createClient(connect.url, connect.anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("tv_get_website_html", { p_website_id: id });
  if (error || !data || data.ok !== true || typeof data.html !== "string") {
    return new NextResponse("Not found", { status: 404 });
  }

  const zoomParam = request.nextUrl.searchParams.get("zoom");
  const zoomLevel = Number(zoomParam ?? data.zoomLevel ?? 100);
  const safeZoom = Number.isFinite(zoomLevel) ? Math.min(200, Math.max(25, zoomLevel)) : 100;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Website display</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }
    #frame {
      width: 100vw;
      height: 100vh;
      transform: scale(${safeZoom / 100});
      transform-origin: top left;
    }
    #frame iframe {
      border: 0;
      width: 100%;
      height: 100%;
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div id="frame">${data.html}</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
