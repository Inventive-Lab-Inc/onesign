"use client";

import { HardDrive, Monitor } from "lucide-react";
import { usePlanQuota } from "@/components/console/plan-quota-context";
import { type PlanViewModel } from "@/components/plans/plan-data";
import { PlanPricingSection } from "@/components/plans/plan-pricing-section";
import { type PlanPricingCardAction } from "@/components/plans/plan-pricing-card";
import { planCurrencyFooter, type PlanCurrency } from "@/lib/plan-currency";
import {
  billingContactMailto,
  billingUpgradeMailto,
  currentPlanLabel,
  getPlanAction,
  matchCatalogPlan,
  type PlanAction,
} from "@/lib/plan/billing";
import {
  deviceUsageRatio,
  deviceUsageTone,
  formatStorageUsage,
  storageUsageRatio,
  storageUsageTone,
} from "@/lib/plan-quota";
import { formatTrialEndDate, formatTrialRemaining, isOnTrial } from "@/lib/trial";
import { cn } from "@/lib/utils";

const meterToneClasses: Record<"ok" | "warn" | "full", { fill: string; text: string }> = {
  ok: { fill: "bg-brand", text: "text-foreground" },
  warn: { fill: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  full: { fill: "bg-red-500", text: "text-red-700 dark:text-red-400" },
};

export function BillingSettingsView({
  plans,
  currency = "USD",
}: {
  plans: PlanViewModel[];
  currency?: PlanCurrency;
}) {
  const quota = usePlanQuota();

  if (!quota) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
        Loading billing details…
      </div>
    );
  }

  const catalog = plans.length > 0 ? plans : [];
  const currentPlan = matchCatalogPlan(catalog, quota);
  const planInfo = currentPlanLabel(catalog, quota);
  const onTrial = quota.isOnTrial ?? isOnTrial(quota);
  const trialRemaining = formatTrialRemaining(quota.trialEndsAt);
  const trialEnd = formatTrialEndDate(quota.trialEndsAt);

  return (
    <div className="space-y-10">
      <CurrentPlanSummary
        planName={planInfo.name}
        planDescription={planInfo.description}
        status={planInfo.status}
        onTrial={onTrial}
        trialRemaining={trialRemaining}
        trialEnd={trialEnd}
        deviceCount={quota.deviceCount}
        deviceLimit={quota.deviceLimit}
        storageUsedBytes={quota.storageUsedBytes}
        storageLimitBytes={quota.storageLimitBytes}
      />

      {catalog.length > 0 ? (
        <PlanPricingSection
          sectionClassName="plan-pricing"
          plans={catalog}
          heading={
            <div className="mx-auto max-w-2xl text-center">
              <h3 className="text-base font-semibold text-foreground">Change plan</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with a 14-day Solo trial, then pick the plan that matches your screen count. No setup
                fees, cancel anytime.
              </p>
            </div>
          }
          isCurrentPlan={(plan) => currentPlan?.id === plan.id}
          getAction={(plan, _index, billingPeriod) =>
            toPricingAction(getPlanAction(currentPlan, plan, quota, billingPeriod))
          }
          enterpriseHref={billingUpgradeMailto("Custom", "monthly")}
        />
      ) : null}

      <footer className="border-t border-border pt-6 text-center text-xs leading-relaxed text-muted-foreground">
        <p>{planCurrencyFooter(currency)}</p>
        <p className="mt-1.5">
          Questions?{" "}
          <a
            href={billingContactMailto()}
            className="font-medium text-brand-strong underline underline-offset-2"
          >
            Contact billing
          </a>
        </p>
      </footer>
    </div>
  );
}

function toPricingAction(action: PlanAction): PlanPricingCardAction {
  return {
    label: action.label,
    href: action.href,
    disabled: action.disabled,
  };
}

function CurrentPlanSummary({
  planName,
  planDescription,
  status,
  onTrial,
  trialRemaining,
  trialEnd,
  deviceCount,
  deviceLimit,
  storageUsedBytes,
  storageLimitBytes,
}: {
  planName: string;
  planDescription: string;
  status: string;
  onTrial: boolean;
  trialRemaining: string | null;
  trialEnd: string | null;
  deviceCount: number;
  deviceLimit: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
}) {
  const screenRatio = deviceUsageRatio(deviceCount, deviceLimit);
  const screenTone = deviceUsageTone(screenRatio);
  const storageRatio = storageUsageRatio(storageUsedBytes, storageLimitBytes);
  const storageTone = storageUsageTone(storageRatio);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Current plan</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{planName}</h2>
            <StatusBadge status={status} onTrial={onTrial} />
          </div>
          <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{planDescription}</p>
        </div>

        {onTrial && trialRemaining ? (
          <div className="shrink-0 rounded-lg bg-amber-50 px-3.5 py-2 text-sm ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10">
            <p className="font-medium text-amber-800 dark:text-amber-300">{trialRemaining}</p>
            {trialEnd ? <p className="text-xs text-amber-700/80 dark:text-amber-400/70">Ends {trialEnd}</p> : null}
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <UsageStat
          icon={Monitor}
          label="Screens"
          valueLabel={`${deviceCount} of ${deviceLimit}`}
          ratio={screenRatio}
          tone={screenTone}
        />
        <UsageStat
          icon={HardDrive}
          label="Storage"
          valueLabel={formatStorageUsage(storageUsedBytes, storageLimitBytes)}
          ratio={storageRatio}
          tone={storageTone}
        />
      </dl>

      {screenTone === "full" ? (
        <p className="border-t border-red-600/15 bg-red-50 px-6 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400 sm:px-8">
          You&apos;ve reached your screen limit. Remove a device or upgrade to add more screens.
        </p>
      ) : null}
    </div>
  );
}

function UsageStat({
  icon: Icon,
  label,
  valueLabel,
  ratio,
  tone,
}: {
  icon: typeof Monitor;
  label: string;
  valueLabel: string;
  ratio: number;
  tone: "ok" | "warn" | "full";
}) {
  const styles = meterToneClasses[tone];
  const pct = Math.round(ratio * 100);

  return (
    <div className="px-6 py-5 sm:px-8">
      <dt className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </dt>
      <dd className={cn("mt-1.5 text-xl font-semibold tabular-nums", styles.text)}>{valueLabel}</dd>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", styles.fill)}
          style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} usage`}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status, onTrial }: { status: string; onTrial: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        onTrial
          ? "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400"
          : "bg-brand-soft text-brand-strong ring-brand/20",
      )}
    >
      {status}
    </span>
  );
}
