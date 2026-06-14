"use client";

import { notFound, useParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { DeviceGroupScreenEditor } from "@/components/device-groups/device-group-screen-editor";
import { useConsoleDataStore } from "@/stores/console-data-store";

function AdminClientGroupDetailPageContent() {
  const params = useParams();
  const { canWrite } = useAdminStaff();
  const id = typeof params?.id === "string" ? params.id : "";
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const lastSyncedAt = useConsoleDataStore((s) => s.lastSyncedAt);
  const deviceGroups = useConsoleDataStore((s) => s.deviceGroups);

  const group = useMemo(
    () => deviceGroups.find((entry) => entry.id === id) ?? null,
    [deviceGroups, id],
  );

  if (!ownerId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (!id) notFound();

  if (!group) {
    if (lastSyncedAt !== null) notFound();
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <DeviceGroupScreenEditor
      groupId={group.id}
      ownerId={ownerId}
      canManagePlaylist={canWrite}
    />
  );
}

export default function AdminClientGroupDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
        </div>
      }
    >
      <AdminClientGroupDetailPageContent />
    </Suspense>
  );
}
