"use client";

import { Suspense } from "react";
import { DevicesManager } from "@/components/devices-manager";
import { ConsolePageSkeleton } from "@/components/console/console-page-skeleton";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";

function DevicesPageContent() {
  const ownerId = useConsoleOwnerId();

  if (!ownerId) {
    return <ConsolePageSkeleton />;
  }

  return <DevicesManager />;
}

export default function DevicesPage() {
  return (
    <Suspense fallback={<ConsolePageSkeleton />}>
      <DevicesPageContent />
    </Suspense>
  );
}
