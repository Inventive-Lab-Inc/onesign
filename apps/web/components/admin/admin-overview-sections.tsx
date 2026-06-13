"use client";

import type { AccessWaitlistEntry, AdminUserDirectoryEntry } from "@signage/types";
import { useState } from "react";
import {
  AdminInviteClientPanel,
  type InviteClientPrefill,
} from "@/components/admin/admin-invite-client-panel";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { AdminWaitlistPanel } from "@/components/admin/admin-waitlist-panel";

interface AdminOverviewSectionsProps {
  users: AdminUserDirectoryEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  initialQuery: string;
  initialStatus: "all" | "active" | "disabled";
  waitlistEntries: AccessWaitlistEntry[];
  pendingWaitlistCount: number;
}

export function AdminOverviewSections({
  users,
  page,
  pageSize,
  totalCount,
  initialQuery,
  initialStatus,
  waitlistEntries,
  pendingWaitlistCount,
}: AdminOverviewSectionsProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePrefill, setInvitePrefill] = useState<InviteClientPrefill | null>(null);

  function openInvite(prefill?: InviteClientPrefill) {
    setInvitePrefill(prefill ?? null);
    setInviteOpen(true);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Client accounts</h2>
          <AdminInviteClientPanel
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            prefill={invitePrefill}
          />
        </div>
        <AdminUsersTable
          users={users}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          initialQuery={initialQuery}
          initialStatus={initialStatus}
        />
      </section>

      <AdminWaitlistPanel
        entries={waitlistEntries}
        pendingCount={pendingWaitlistCount}
        onInvite={(prefill) => openInvite(prefill)}
      />
    </div>
  );
}
