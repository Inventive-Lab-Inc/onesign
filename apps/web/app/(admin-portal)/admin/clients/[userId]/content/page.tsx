"use client";

import { Suspense } from "react";
import { MediaLibrary } from "@/components/media-library";
import { useConsoleDataStore } from "@/stores/console-data-store";

function AdminClientContentPageContent() {
  const ownerId = useConsoleDataStore((s) => s.ownerId);

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

export default function AdminClientContentPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
        </div>
      }
    >
      <AdminClientContentPageContent />
    </Suspense>
  );
}
