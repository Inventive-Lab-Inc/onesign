import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name: string, email?: string | null): string {
  const source = name.trim() || email?.split("@")[0]?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AccountIdentityCard({
  name,
  email,
}: {
  name: string;
  email: string | null | undefined;
}) {
  const displayName = name.trim() || email?.split("@")[0] || "Console user";
  const initials = getInitials(name, email);

  return (
    <article className="account-identity-card account-page-enter rounded-2xl border border-brand-faint20 shadow-sm">
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={cn(
              "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl",
              "bg-gradient-to-br from-brand via-brand-hover to-brand-heading text-lg font-bold tracking-tight text-brand-contrast shadow-lg",
              "ring-4 ring-brand-soft",
            )}
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="truncate text-lg font-bold tracking-tight text-foreground">{displayName}</p>
            <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0 text-brand-muted" aria-hidden />
              <span className="truncate">{email ?? "—"}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-faint25 bg-brand-softest px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-brand-badge">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Active session
          </span>
        </div>
      </div>

      <div className="relative border-t border-brand-faint20 bg-muted/20 px-5 py-3.5 sm:px-6">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Display name</dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{displayName}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Email address</dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{email ?? "—"}</dd>
            </div>
          </div>
        </dl>
      </div>
    </article>
  );
}
