"use client";

import { notFound, useParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { DeviceScreenEditor } from "@/components/device-screen-editor";
import { useDevicePageAutoSync } from "@/hooks/use-device-page-auto-sync";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { useConsoleDataStore } from "@/stores/console-data-store";

function DeviceDetailPageContent() {
  useDevicePageAutoSync();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const ownerId = useConsoleOwnerId();
  const lastSyncedAt = useConsoleDataStore((s) => s.lastSyncedAt);
  const devices = useConsoleDataStore((s) => s.devices);

  const device = useMemo(
    () =>
      (devices as DeviceWithAssignments[]).find((d) => d.public_code === id),
    [devices, id],
  );

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

  if (!device) {
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

  return <DeviceScreenEditor deviceId={device.id} ownerId={ownerId} />;
}

export default function DeviceDetailPage() {
  return (
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
          </div>
        }
      >
        <DeviceDetailPageContent />
      </Suspense>
  );
}
