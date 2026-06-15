"use client";

import { Suspense } from "react";
import { WebsitesWorkspace } from "@/components/websites/websites-workspace";
import { useOptionalAdminStaff } from "@/components/admin/admin-staff-context";
import { useConsoleDataStore } from "@/stores/console-data-store";

function AdminClientWebsitesPageContent() {
  const ownerId = useConsoleDataStore((s) => s.ownerId);
  const adminStaff = useOptionalAdminStaff();
  const readOnly = adminStaff != null && !adminStaff.canWrite;

  if (!ownerId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return <WebsitesWorkspace userId={ownerId} readOnly={readOnly} />;
}

export default function AdminClientWebsitesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
        </div>
      }
    >
      <AdminClientWebsitesPageContent />
    </Suspense>
  );
}
