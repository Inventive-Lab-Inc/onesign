import { formatTrialRemaining, isTrialExpired } from "@/lib/trial";
import { cn } from "@/lib/utils";

type AccountStatusBadgeProps = {
  isDisabled: boolean;
  invitationPending?: boolean;
  trialEndsAt?: string | null;
  trialExpired?: boolean;
};

export function AccountStatusBadge({
  isDisabled,
  invitationPending,
  trialEndsAt,
  trialExpired,
}: AccountStatusBadgeProps) {
  const expired = trialExpired ?? isTrialExpired(trialEndsAt);

  if (invitationPending) {
    return (
      <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
        Invite pending
      </span>
    );
  }

  if (isDisabled) {
    return (
      <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
        Disabled
      </span>
    );
  }

  if (expired) {
    return (
      <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
        Trial expired
      </span>
    );
  }

  if (trialEndsAt) {
    return (
      <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
        {formatTrialRemaining(trialEndsAt) ?? "Trial"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
      )}
    >
      Active
    </span>
  );
}
