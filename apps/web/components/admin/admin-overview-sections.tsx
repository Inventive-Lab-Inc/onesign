"use client";

import type { AdminUserDirectoryEntry, PlanTemplate } from "@signage/types";
import { AdminAddClientPanel } from "@/components/admin/admin-add-client-panel";
import { AdminUsersTable } from "@/components/admin/admin-users-table";

interface AdminOverviewSectionsProps {
  users: AdminUserDirectoryEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  initialQuery: string;
  initialStatus: "all" | "active" | "disabled";
  plans: PlanTemplate[];
}

export function AdminOverviewSections({
  users,
  page,
  pageSize,
  totalCount,
  initialQuery,
  initialStatus,
  plans,
}: AdminOverviewSectionsProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Client accounts</h2>
          <AdminAddClientPanel plans={plans} />
        </div>
        <AdminUsersTable
          users={users}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          initialQuery={initialQuery}
          initialStatus={initialStatus}
          plans={plans}
        />
      </section>
    </div>
  );
}
