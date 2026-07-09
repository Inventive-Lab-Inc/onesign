"use client";

import type { AdminUserDirectoryEntry, PlanTemplate } from "@signage/types";
import { ChevronLeft, ChevronRight, Loader2, Mail, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AdminClientActivateButton } from "@/components/admin/admin-client-activate-button";
import { AdminClientDeleteButton } from "@/components/admin/admin-client-delete-button";
import { AdminClientPlanBadge } from "@/components/admin/admin-client-plan-badge";
import { ClientSettingsButton } from "@/components/admin/client-settings-button";
import { AccountStatusBadge } from "@/components/admin/account-status-badge";
import { AdminAccountActions } from "@/components/admin/admin-account-actions";
import { PlanUsageMeter } from "@/components/plan/plan-usage-meter";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { useAppRouter } from "@/hooks/use-app-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "disabled";

async function resendClientInvite(email: string) {
  const response = await fetch("/api/admin/resend-setup-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to resend invitation");
  }
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? `Invitation resent to ${email}`;
}

function ResendInviteButton({ email }: { email: string }) {
  const router = useAppRouter();
  const [loading, setLoading] = useState(false);
  const label = "Resend invitation";

  return (
    <Tooltip label={label}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        aria-label={label}
        className="h-8 w-8 shrink-0 p-0"
        onClick={() => {
          setLoading(true);
          void (async () => {
            try {
              const message = await resendClientInvite(email);
              toast.success(message);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not resend invitation");
            } finally {
              setLoading(false);
            }
          })();
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Mail className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </Tooltip>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "disabled", label: "Disabled" },
];

function buildAdminListUrl({
  page,
  query,
  status,
}: {
  page: number;
  query: string;
  status: StatusFilter;
}): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  const trimmed = query.trim();
  if (trimmed) params.set("q", trimmed);
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  return qs ? `/admin?${qs}` : "/admin";
}

export function AdminUsersTable({
  users,
  page,
  pageSize,
  totalCount,
  initialQuery,
  initialStatus,
  plans,
}: {
  users: AdminUserDirectoryEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  initialQuery: string;
  initialStatus: StatusFilter;
  plans: PlanTemplate[];
}) {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const { canWrite } = useAdminStaff();
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
    setStatusFilter(initialStatus);
  }, [initialQuery, initialStatus]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const serverQuery = searchParams.get("q") ?? "";
  const normalizedQuery = query.trim().toLowerCase();
  const visibleUsers = useMemo(() => {
    if (!normalizedQuery) return users;
    return users.filter((user) => {
      const name = user.client_name?.toLowerCase() ?? "";
      return name.includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery);
    });
  }, [users, normalizedQuery]);

  // True while we're filtering the loaded page locally and haven't asked the server yet.
  const isLocalSearch = normalizedQuery.length > 0 && query.trim() !== serverQuery;

  const countLabel = isLocalSearch
    ? visibleUsers.length === 0
      ? "Searching all accounts…"
      : `Showing ${visibleUsers.length} ${visibleUsers.length === 1 ? "account" : "accounts"} matching “${query.trim()}”.`
    : totalCount === 0
      ? "No accounts match your filters."
      : `Showing ${rangeStart}–${rangeEnd} of ${totalCount} accounts${initialQuery ? ` matching “${initialQuery}”` : ""}.`;

  const navigate = useCallback(
    (next: { page?: number; query?: string; status?: StatusFilter }) => {
      const url = buildAdminListUrl({
        page: next.page ?? 1,
        query: next.query ?? query,
        status: next.status ?? statusFilter,
      });
      startTransition(() => {
        router.push(url);
      });
    },
    [query, router, statusFilter],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === serverQuery) return;

    // Client-side filtering already covers matches on the loaded page, so only
    // fall back to a server search when nothing matches locally (or the box was cleared).
    if (trimmed && visibleUsers.length > 0) return;

    const timer = window.setTimeout(() => {
      navigate({ page: 1, query: trimmed });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query, serverQuery, visibleUsers.length, navigate]);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border/90 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th colSpan={8} className="px-4 py-3 font-normal">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="relative min-w-0 flex-1 sm:max-w-md">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden
                        />
                        <Input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              navigate({ page: 1, query: query.trim() });
                            }
                          }}
                          placeholder="Search by name or email…"
                          className="h-10 pl-9 pr-9"
                          aria-label="Search client accounts"
                        />
                        {query ? (
                          <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Clear search"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>

                      <p className="shrink-0 text-xs font-normal text-muted-foreground">
                        {countLabel}
                        {isPending ? " Loading…" : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {STATUS_FILTERS.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setStatusFilter(id);
                            navigate({ page: 1, status: id });
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                            statusFilter === id
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Screens</th>
                <th className="px-4 py-3">Storage</th>
                <th className="px-4 py-3">Online</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    {isLocalSearch ? (
                      <p className="text-sm font-medium text-foreground">Searching all accounts…</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-foreground">No accounts match your filters</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Try a different search or clear the status filter.
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                visibleUsers.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/admin/clients/${row.id}`)}
                    className={cn(
                      "cursor-pointer border-b border-border/80 transition-colors last:border-0 hover:bg-muted/40",
                      row.is_disabled && "bg-muted/20",
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.client_name?.trim() || "—"}</span>
                        {row.is_staff ? (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            Admin
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[0.6875rem] font-normal leading-tight text-muted-foreground">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <AccountStatusBadge
                        isDisabled={row.is_disabled}
                        invitationPending={row.invitation_pending}
                        trialEndsAt={row.trial_ends_at}
                        trialExpired={row.trial_expired}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <AdminClientPlanBadge row={row} plans={plans} />
                    </td>
                    <td className="px-4 py-3">
                      <PlanUsageMeter
                        variant="screens"
                        used={row.device_count}
                        limit={row.device_limit}
                        layout="compact"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PlanUsageMeter
                        variant="storage"
                        used={row.storage_used_bytes}
                        limit={row.storage_limit_bytes}
                        layout="stacked"
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.online_device_count}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {!row.is_staff && canWrite ? (
                          <>
                            {row.invitation_pending ? (
                              <ResendInviteButton email={row.email} />
                            ) : null}
                            <AdminClientDeleteButton
                              userId={row.id}
                              email={row.email}
                              clientName={row.client_name}
                            />
                            <AdminClientActivateButton client={row} plans={plans} />
                            <AdminAccountActions
                              userId={row.id}
                              email={row.email}
                              isDisabled={row.is_disabled}
                            />
                          </>
                        ) : null}
                        <ClientSettingsButton userId={row.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => navigate({ page: page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => navigate({ page: page + 1 })}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
