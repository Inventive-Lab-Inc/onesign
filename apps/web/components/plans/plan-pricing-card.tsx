"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { cn } from "@/lib/utils";
import {
  getPlanDisplayPricing,
  planIconForIndex,
  type BillingPeriod,
  type PlanViewModel,
} from "./plan-data";
import "./plan-pricing.css";

export type PlanPricingCardAction = {
  label: string;
  href?: string;
  disabled?: boolean;
  checkout?: {
    planId: string;
    billingPeriod: BillingPeriod;
  };
};

type PreviewResponse = {
  mode?: "new_checkout" | "plan_switch";
  copy?: {
    title: string;
    bullets: string[];
    confirmLabel: string;
  };
  error?: string;
};

export function PlanPricingCard({
  plan,
  index,
  action,
  billingPeriod = "monthly",
  isCurrent = false,
  scalePopular = true,
  className,
}: {
  plan: PlanViewModel;
  index: number;
  action: PlanPricingCardAction;
  billingPeriod?: BillingPeriod;
  isCurrent?: boolean;
  scalePopular?: boolean;
  className?: string;
}) {
  const popular = plan.highlighted;
  const Icon = planIconForIndex(index);
  const pricing = getPlanDisplayPricing(plan, billingPeriod);

  return (
    <div
      className={cn(
        "plan-pricing-card p-6",
        popular && "plan-pricing-card--popular",
        isCurrent && "plan-pricing-card--current",
        scalePopular && popular && "xl:scale-[1.03]",
        className,
      )}
    >
      {isCurrent ? (
        <span className="plan-pricing-badge plan-pricing-badge--current absolute right-5 top-5 rounded-full px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider">
          Current
        </span>
      ) : popular && plan.badge ? (
        <span className="plan-pricing-badge absolute right-5 top-5 rounded-full px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider">
          {plan.badge}
        </span>
      ) : null}

      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          popular ? "bg-white/15 text-white" : "bg-brand-soft text-brand-strong",
        )}
      >
        <Icon size={18} strokeWidth={2} />
      </span>

      <h3 className={cn("mt-4 text-lg font-bold", popular ? "text-white" : "text-foreground")}>{plan.name}</h3>
      <p className={cn("text-sm", popular ? "text-white/60" : "text-muted-foreground")}>{plan.tagline}</p>

      <div className="mt-4 flex items-end gap-1.5">
        <span className={cn("text-3xl font-bold tracking-tight", popular ? "text-white" : "text-foreground")}>
          {pricing.priceLabel}
        </span>
        {pricing.showOriginalStrike && pricing.originalPriceLabel ? (
          <span
            className={cn(
              "mb-1 text-sm font-semibold line-through",
              popular ? "text-white/45" : "text-muted-foreground/70",
            )}
          >
            {pricing.originalPriceLabel}
          </span>
        ) : null}
        {!plan.isFree ? (
          <span className={cn("mb-1 text-xs font-medium", popular ? "text-white/55" : "text-muted-foreground")}>
            /mo · {plan.screens}
            {pricing.billingSuffix}
          </span>
        ) : (
          <span className={cn("mb-1 text-xs font-medium", popular ? "text-white/55" : "text-muted-foreground")}>
            · {plan.screens}
          </span>
        )}
      </div>

      {!plan.isFree && pricing.perScreenLabel ? (
        <p className={cn("mt-1 text-xs", popular ? "text-white/50" : "text-muted-foreground")}>
          {pricing.perScreenLabel}
        </p>
      ) : null}

      <ul className="mt-5 space-y-2">
        {plan.features.slice(0, 4).map((feature) => (
          <li
            key={feature}
            className={cn("flex items-center gap-2 text-sm", popular ? "text-white/85" : "text-foreground")}
          >
            <Check
              size={14}
              strokeWidth={2.5}
              className={popular ? "plan-pricing-check--dark" : "plan-pricing-check"}
            />
            {feature}
          </li>
        ))}
      </ul>

      <PlanPricingCardActionButton popular={popular} action={action} planName={plan.name} />
    </div>
  );
}

function PlanPricingCardActionButton({
  popular,
  action,
  planName,
}: {
  popular: boolean;
  action: PlanPricingCardAction;
  planName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState(`Change to ${planName}?`);
  const [confirmBullets, setConfirmBullets] = useState<string[]>([
    "We’ll show payment details before anything is charged.",
  ]);
  const [confirmLabel, setConfirmLabel] = useState(action.label);

  const className = cn(
    "mt-6 flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors",
    action.disabled
      ? "plan-pricing-cta-disabled"
      : popular
        ? "plan-pricing-cta-popular"
        : "plan-pricing-cta-default",
  );

  async function openConfirm() {
    if (!action.checkout) return;
    setConfirmOpen(true);
    setPreviewLoading(true);
    setConfirmTitle(`Change to ${planName}?`);
    setConfirmBullets(["Checking what you’ll pay…"]);
    setConfirmLabel(action.label);

    try {
      const response = await fetch("/api/stripe/preview-plan-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTemplateId: action.checkout.planId,
          billingPeriod: action.checkout.billingPeriod,
        }),
      });
      const payload = (await response.json()) as PreviewResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Could not preview plan change");
      }
      if (payload.copy) {
        setConfirmTitle(payload.copy.title);
        setConfirmBullets(payload.copy.bullets);
        setConfirmLabel(payload.copy.confirmLabel);
      }
    } catch {
      // Soft fallback — still explain before charging.
      setConfirmTitle(`Change to ${planName}?`);
      setConfirmBullets([
        "If this is your first payment, you’ll go to the secure payment page.",
        "If you already pay for a plan, we’ll update it on your saved card (charge or credit for days left this month).",
      ]);
      setConfirmLabel(action.label);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function startCheckout() {
    if (!action.checkout) return;

    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTemplateId: action.checkout.planId,
          billingPeriod: action.checkout.billingPeriod,
        }),
      });

      const payload = (await response.json()) as {
        url?: string;
        upgraded?: boolean;
        redirectUrl?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Checkout failed");
      }

      // Existing subscriber: plan changed in Stripe (prorated), no Checkout page.
      if (payload.upgraded) {
        window.location.href = payload.redirectUrl || payload.url || "/account?tab=billing&checkout=success";
        return;
      }

      if (!payload.url) {
        throw new Error(payload.error || "Checkout failed");
      }

      // In-place switch may return our billing-return URL instead of Stripe Checkout.
      if (
        payload.url.includes("/mobile/billing-return") ||
        (payload.url.includes("/account") && payload.url.includes("checkout=success"))
      ) {
        window.location.href = payload.url;
        return;
      }

      window.location.href = payload.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed");
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  if (action.disabled) {
    return <span className={className}>{action.label}</span>;
  }

  if (action.checkout) {
    return (
      <>
        <button
          type="button"
          className={className}
          disabled={loading}
          onClick={() => void openConfirm()}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : action.label}
        </button>
        <ConfirmActionDialog
          open={confirmOpen}
          title={confirmTitle}
          description={
            <ul className="list-disc space-y-1.5 pl-4">
              {confirmBullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          }
          confirmLabel={previewLoading ? "Checking…" : confirmLabel}
          confirmingLabel="Working…"
          isConfirming={loading}
          confirmDisabled={previewLoading}
          onClose={() => {
            if (!loading) setConfirmOpen(false);
          }}
          onConfirm={() => {
            if (previewLoading || loading) return;
            void startCheckout();
          }}
        />
      </>
    );
  }

  if (!action.href) {
    return <span className={className}>{action.label}</span>;
  }

  if (action.href.startsWith("mailto:") || action.href.startsWith("http")) {
    return (
      <a href={action.href} className={className}>
        {action.label}
      </a>
    );
  }

  return (
    <Link href={action.href} className={className}>
      {action.label}
    </Link>
  );
}
