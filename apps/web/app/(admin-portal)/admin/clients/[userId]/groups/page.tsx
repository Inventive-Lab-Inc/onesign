"use client";

import { Suspense } from "react";
import { DeviceGroupsManager } from "@/components/device-groups/device-groups-manager";
import { useConsoleDataStore } from "@/stores/console-data-store";

function AdminClientGroupsPageContent() {
  const ownerId = useConsoleDataStore((s) => s.ownerId);

  if (!ownerId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return <DeviceGroupsManager />;
}

export default function AdminClientGroupsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
        </div>
      }
    >
      <AdminClientGroupsPageContent />
    </Suspense>
  );
}
