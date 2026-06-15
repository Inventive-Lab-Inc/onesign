"use client";

import { notFound, useParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { MediaDetailWorkspace } from "@/components/media/media-detail-workspace";
import { useConsoleDataStore } from "@/stores/console-data-store";

function ContentDetailPageContent() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const lastSyncedAt = useConsoleDataStore((s) => s.lastSyncedAt);
  const media = useConsoleDataStore((s) => s.media);

  const item = useMemo(() => media.find((entry) => entry.id === id), [media, id]);

  if (!ownerId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (!id) {
    notFound();
  }

  if (!item) {
    if (lastSyncedAt !== null) {
      notFound();
    }
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return <MediaDetailWorkspace mediaId={item.id} ownerId={ownerId} />;
}

export default function ContentDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
        </div>
      }
    >
      <ContentDetailPageContent />
    </Suspense>
  );
}
