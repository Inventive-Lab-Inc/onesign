"use client";

import { Suspense } from "react";
import { DevicesManager } from "@/components/devices-manager";
import { ConsolePageSkeleton } from "@/components/console/console-page-skeleton";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";
import { useDevicePageAutoSync } from "@/hooks/use-device-page-auto-sync";

function DevicesPageContent() {
  useDevicePageAutoSync();
  const ownerId = useConsoleOwnerId();

  if (!ownerId) {
    return <ConsolePageSkeleton />;
  }

  return <DevicesManager />;
}

export default function DevicesPage() {
  return (
    <div className="mx-auto max-w-6xl pb-4">
      <Suspense fallback={<ConsolePageSkeleton />}>
        <DevicesPageContent />
      </Suspense>
    </div>
  );
}
