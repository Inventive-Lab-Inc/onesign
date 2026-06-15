"use client";

import { notFound, useParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { WebsiteDetailWorkspace } from "@/components/websites/website-detail-workspace";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { useConsoleDataStore } from "@/stores/console-data-store";

function AdminClientWebsiteDetailPageContent() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const lastSyncedAt = useConsoleDataStore((s) => s.lastSyncedAt);
  const websites = useConsoleDataStore((s) => s.websites);
  const adminStaff = useOptionalAdminStaff();
  const readOnly = adminStaff != null && !adminStaff.canWrite;

  const item = useMemo(() => websites.find((entry) => entry.id === id), [websites, id]);

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

  return <WebsiteDetailWorkspace websiteId={item.id} ownerId={ownerId} readOnly={readOnly} />;
}

export default function AdminClientWebsiteDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
        </div>
      }
    >
      <AdminClientWebsiteDetailPageContent />
    </Suspense>
  );
}
