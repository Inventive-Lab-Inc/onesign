import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function WebsiteDisplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zoom?: string }>;
}) {
  const { id } = await params;
  const { zoom } = await searchParams;
  const supabase = getServiceClient();
  if (!supabase) notFound();

  const { data, error } = await supabase.rpc("tv_get_website_html", { p_website_id: id });
  if (error || !data || data.ok !== true || typeof data.html !== "string") {
    notFound();
  }

  const zoomLevel = Number(zoom ?? data.zoomLevel ?? 100);
  const safeZoom = Number.isFinite(zoomLevel) ? Math.min(200, Math.max(25, zoomLevel)) : 100;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Website display</title>
        <style>{`
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
        `}</style>
      </head>
      <body>
        <div id="frame" dangerouslySetInnerHTML={{ __html: data.html }} />
      </body>
    </html>
  );
}
