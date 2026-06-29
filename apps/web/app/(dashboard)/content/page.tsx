"use client";

import { Suspense } from "react";
import { MediaLibrary } from "@/components/media-library";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";

function ContentPageContent() {
  const ownerId = useConsoleOwnerId();

  if (!ownerId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return <MediaLibrary userId={ownerId} />;
}

export default function ContentPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
        </div>
      }
    >
      <ContentPageContent />
    </Suspense>
  );
}
