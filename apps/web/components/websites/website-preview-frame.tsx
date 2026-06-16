"use client";

import type { Website } from "@signage/types";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { websitePreviewUrl } from "@/lib/website-playback";
import { cn } from "@/lib/utils";

export function WebsitePreviewFrame({
  website,
  className,
  zoomLevel,
}: {
  website: Pick<Website, "name" | "source_type" | "url" | "playback_url" | "zoom_level">;
  className?: string;
  zoomLevel?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const previewUrl = websitePreviewUrl(website);
  const zoom = zoomLevel ?? website.zoom_level ?? 100;

  return (
    <div className={cn("relative overflow-hidden bg-muted/40", className)}>
      {loading && !failed ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/70 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
          <span>Generating preview…</span>
        </div>
      ) : null}
      {failed ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80 px-4 text-center text-sm text-muted-foreground">
          Preview unavailable
        </div>
      ) : null}
      <iframe
        title={`Preview of ${website.name}`}
        src={previewUrl}
        className="h-full w-full border-0 bg-white"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top left",
          width: `${10000 / zoom}%`,
          height: `${10000 / zoom}%`,
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
    </div>
  );
}
