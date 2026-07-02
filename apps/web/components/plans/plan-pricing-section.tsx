"use client";

import { useState, type ReactNode } from "react";
import { BillingPeriodToggle } from "./billing-period-toggle";
import {
  catalogHasPaidPlans,
  planGridClassName,
  type BillingPeriod,
  type PlanViewModel,
} from "./plan-data";
import { PlanPricingCard, type PlanPricingCardAction } from "./plan-pricing-card";
import { cn } from "@/lib/utils";

export function PlanPricingSection({
  plans,
  heading,
  getAction,
  isCurrentPlan,
  enterpriseHref = "mailto:aminulislamborhan@gmail.com?subject=OneSign%20Custom%20plan",
  sectionClassName = "plan-pricing px-5 py-20",
  id,
}: {
  plans: PlanViewModel[];
  heading: ReactNode;
  getAction: (plan: PlanViewModel, index: number, billingPeriod: BillingPeriod) => PlanPricingCardAction;
  isCurrentPlan?: (plan: PlanViewModel) => boolean;
  enterpriseHref?: string;
  sectionClassName?: string;
  id?: string;
}) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const showBillingToggle = catalogHasPaidPlans(plans);

  return (
    <section id={id} className={sectionClassName}>
      <div className="mx-auto w-full max-w-6xl">
        {heading}
        {showBillingToggle ? (
          <div className="mt-8 flex justify-center">
            <BillingPeriodToggle value={billingPeriod} onChange={setBillingPeriod} />
          </div>
        ) : null}
        <div
          className={cn(
            "grid gap-5 md:items-center",
            showBillingToggle ? "mt-8" : "mt-12",
            planGridClassName(plans.length),
          )}
        >
          {plans.map((plan, index) => (
            <PlanPricingCard
              key={plan.id}
              plan={plan}
              index={index}
              billingPeriod={billingPeriod}
              isCurrent={isCurrentPlan?.(plan) ?? false}
              action={getAction(plan, index, billingPeriod)}
            />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Need 20+ screens?{" "}
          <a href={enterpriseHref} className="font-medium text-brand-strong underline underline-offset-2">
            Contact us for custom pricing
          </a>
          .
        </p>
      </div>
    </section>
  );
}
