"use client";

import { Suspense } from "react";
import { FileManagementWorkspace } from "@/components/media/file-management-workspace";
import { useConsoleDataStore } from "@/stores/console-data-store";

function FileManagementPageContent() {
  const ownerId = useConsoleDataStore((s) => s.ownerId);

  if (!ownerId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return <FileManagementWorkspace userId={ownerId} />;
}

export default function FileManagementPage() {
  return (
    <div className="mx-auto max-w-6xl pb-4">
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
          </div>
        }
      >
        <FileManagementPageContent />
      </Suspense>
    </div>
  );
}
