"use client";

import type { AccessWaitlistEntry } from "@signage/types";
import { Clock3, Inbox, MailPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { InviteClientPrefill } from "@/components/admin/admin-invite-client-panel";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WaitlistFilter = "all" | AccessWaitlistEntry["status"];

const WAITLIST_FILTERS: { id: WaitlistFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "reviewed", label: "Reviewed" },
  { id: "invited", label: "Invited" },
  { id: "dismissed", label: "Dismissed" },
];

const STATUS_LABELS: Record<AccessWaitlistEntry["status"], string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  invited: "Invited",
  dismissed: "Dismissed",
};

async function updateWaitlistStatus(id: string, status: AccessWaitlistEntry["status"]) {
  const response = await fetch("/api/admin/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ id, status }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not update request");
  }
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function WaitlistStatusBadge({ status }: { status: AccessWaitlistEntry["status"] }) {
  const tone =
    status === "pending"
      ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
      : status === "invited"
        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
        : status === "reviewed"
          ? "bg-sky-500/15 text-sky-800 dark:text-sky-200"
          : "bg-muted text-muted-foreground";

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", tone)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface AdminWaitlistPanelProps {
  entries: AccessWaitlistEntry[];
  pendingCount: number;
  onInvite: (prefill: InviteClientPrefill) => void;
}

export function AdminWaitlistPanel({ entries, pendingCount, onInvite }: AdminWaitlistPanelProps) {
  const router = useRouter();
  const { canWrite } = useAdminStaff();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<WaitlistFilter>("all");

  const filteredEntries = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter((entry) => entry.status === filter);
  }, [entries, filter]);

  async function handleStatus(id: string, status: AccessWaitlistEntry["status"]) {
    setLoadingId(id);
    try {
      await updateWaitlistStatus(id, status);
      toast.success(status === "dismissed" ? "Request dismissed" : "Request updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update request");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/90 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Inbox className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Access requests</h2>
            <p className="text-xs text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} pending — review applications and invite approved users`
                : "Review applications and invite approved users"}
            </p>
          </div>
        </div>
        {pendingCount > 0 ? (
          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
            {pendingCount} pending
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border/60 px-4 py-3">
        {WAITLIST_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition",
              filter === id
                ? "border-brand-faint25 bg-brand-faint15 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredEntries.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No access requests in this view</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === "pending"
              ? "New applications from the login page will appear here."
              : "Try another filter or wait for new applications."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {filteredEntries.map((entry) => {
            const busy = loadingId === entry.id;
            const canAct = entry.status === "pending" || entry.status === "reviewed";

            return (
              <li
                key={entry.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{entry.email}</p>
                    <WaitlistStatusBadge status={entry.status} />
                    {entry.company_name ? (
                      <span className="text-xs text-muted-foreground">· {entry.company_name}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" aria-hidden />
                      {formatRelativeDate(entry.created_at)}
                    </span>
                    {entry.screen_count ? <span>· {entry.screen_count} screens</span> : null}
                    {entry.reviewed_at ? (
                      <span>· Reviewed {formatRelativeDate(entry.reviewed_at)}</span>
                    ) : null}
                  </div>
                  {entry.message ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{entry.message}</p>
                  ) : null}
                </div>

                {canWrite && canAct ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() =>
                        onInvite({
                          email: entry.email,
                          clientName: entry.company_name ?? undefined,
                          deviceLimit: entry.screen_count ?? 1,
                          waitlistId: entry.id,
                        })
                      }
                    >
                      <MailPlus className="h-3.5 w-3.5" aria-hidden />
                      Invite
                    </Button>
                    {entry.status === "pending" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleStatus(entry.id, "reviewed")}
                        >
                          Mark reviewed
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          disabled={busy}
                          onClick={() => void handleStatus(entry.id, "dismissed")}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                          Dismiss
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={busy}
                        onClick={() => void handleStatus(entry.id, "dismissed")}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        Dismiss
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
