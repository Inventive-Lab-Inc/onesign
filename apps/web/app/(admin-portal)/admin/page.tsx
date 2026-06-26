import type { AdminDirectoryStats, AdminUserDirectoryEntry } from "@signage/types";
import { Clock3, Info, Monitor, Users } from "lucide-react";
import { AdminOverviewSections } from "@/components/admin/admin-overview-sections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerStaffAuth } from "@/lib/auth/staff";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const STAT_CARD_CLASS =
  "group border-border/90 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-faint25 hover:shadow-md";

const STAT_ICON_BASE = "rounded-lg bg-muted/60 p-2 transition-colors";

const STAT_ICON_BRAND = `${STAT_ICON_BASE} group-hover:bg-brand-soft`;
const STAT_ICON_EMERALD = `${STAT_ICON_BASE} group-hover:bg-emerald-100`;
const STAT_ICON_AMBER = `${STAT_ICON_BASE} group-hover:bg-amber-100`;
const STAT_ICON_RED = `${STAT_ICON_BASE} group-hover:bg-red-100`;

function InfoHint({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("group/info relative ml-auto inline-flex", className)}>
      <button
        type="button"
        aria-label={text}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-faint30"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 w-max max-w-[13rem] rounded-md border border-border bg-card px-2.5 py-1.5 text-xs leading-snug text-muted-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

type AdminOverviewSearchParams = {
  page?: string;
  q?: string;
  status?: string;
};

function parsePage(value: string | undefined): number {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseStatus(value: string | undefined): "all" | "active" | "disabled" {
  if (value === "active" || value === "disabled") return value;
  return "all";
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: AdminOverviewSearchParams;
}) {
  const ctx = await getServerStaffAuth();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const page = parsePage(searchParams.page);
  const status = parseStatus(searchParams.status);
  const search = searchParams.q?.trim() || null;
  const offset = (page - 1) * PAGE_SIZE;

  const [statsResult, listResult] = await Promise.all([
    ctx.supabase.rpc("admin_directory_stats"),
    ctx.supabase.rpc("admin_list_users", {
      p_limit: PAGE_SIZE,
      p_offset: offset,
      p_search: search,
      p_status: status,
    }),
  ]);

  if (statsResult.error) {
    throw new Error(statsResult.error.message);
  }
  if (listResult.error) {
    throw new Error(listResult.error.message);
  }

  const statsRows = (statsResult.data as AdminDirectoryStats[]) ?? [];
  const stats = statsRows[0] ?? {
    client_count: 0,
    device_count: 0,
    online_device_count: 0,
    disabled_count: 0,
    active_trial_count: 0,
    expired_trial_count: 0,
  };

  const users = (listResult.data as AdminUserDirectoryEntry[]) ?? [];
  const totalCount = users[0]?.total_count ?? users.length;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Client directory</h1>
        <p className="text-sm text-muted-foreground">
          Browse client accounts, manage devices and content, and control account status.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className={STAT_CARD_CLASS}>
          <CardHeader className="space-y-2 pb-2">
            <div className="flex items-center gap-2.5">
              <div className={STAT_ICON_BRAND}>
                <Users className="h-4 w-4 text-brand-strong" aria-hidden />
              </div>
              <CardTitle className="text-base">Clients</CardTitle>
              <InfoHint text="Registered business accounts" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{stats.client_count}</p>
          </CardContent>
        </Card>

        <Card className={STAT_CARD_CLASS}>
          <CardHeader className="space-y-2 pb-2">
            <div className="flex items-center gap-2.5">
              <div className={STAT_ICON_BRAND}>
                <Monitor className="h-4 w-4 text-brand-strong" aria-hidden />
              </div>
              <CardTitle className="text-base">Devices</CardTitle>
              <InfoHint text="Linked screens across all clients" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{stats.device_count}</p>
          </CardContent>
        </Card>

        <Card className={STAT_CARD_CLASS}>
          <CardHeader className="space-y-2 pb-2">
            <div className="flex items-center gap-2.5">
              <div className={STAT_ICON_EMERALD}>
                <Monitor className="h-4 w-4 text-emerald-600" aria-hidden />
              </div>
              <CardTitle className="text-base">Online now</CardTitle>
              <InfoHint text="Screens reporting recent heartbeats" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{stats.online_device_count}</p>
          </CardContent>
        </Card>

        <Card className={STAT_CARD_CLASS}>
          <CardHeader className="space-y-2 pb-2">
            <div className="flex items-center gap-2.5">
              <div className={STAT_ICON_AMBER}>
                <Clock3 className="h-4 w-4 text-amber-600" aria-hidden />
              </div>
              <CardTitle className="text-base">Active trials</CardTitle>
              <InfoHint text="Self-serve signups still in trial" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{stats.active_trial_count ?? 0}</p>
          </CardContent>
        </Card>

        <Card className={STAT_CARD_CLASS}>
          <CardHeader className="space-y-2 pb-2">
            <div className="flex items-center gap-2.5">
              <div className={STAT_ICON_RED}>
                <Users className="h-4 w-4 text-red-600" aria-hidden />
              </div>
              <CardTitle className="text-base">Expired trials</CardTitle>
              <InfoHint text="Need upgrade or extension" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{stats.expired_trial_count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <AdminOverviewSections
        users={users}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        initialQuery={search ?? ""}
        initialStatus={status}
      />
    </div>
  );
}
