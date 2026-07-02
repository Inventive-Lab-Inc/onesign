"use client";

import { PlanPricingSection } from "@/components/plans/plan-pricing-section";
import { appUrl } from "@/lib/site-hosts";
import { buildSignupHref } from "@/lib/plan/signup-link";
import type { PlanViewModel } from "@/components/plans/plan-data";

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="landing-eyebrow inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-[2.25rem]">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function LandingPricingSection({ plans }: { plans: PlanViewModel[] }) {
  return (
    <PlanPricingSection
      id="pricing"
      plans={plans}
      heading={
        <SectionHeading
          eyebrow="Pricing"
          title="Simple plans that scale with you"
          subtitle="Start with a 14-day Solo trial, then pick the plan that matches your screen count. No setup fees, cancel anytime."
        />
      }
      getAction={(plan) => ({
        label: plan.ctaLabel,
        href: appUrl(buildSignupHref(plan.slug)),
      })}
    />
  );
}
