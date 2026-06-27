"use client";

import { Check, Monitor, RefreshCw, ShieldCheck, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { plans, type Plan } from "./plan-data";
import "./plans.css";

const trustBadges = [
  { icon: ShieldCheck, label: "No setup fees" },
  { icon: Sparkles, label: "All core features included" },
  { icon: RefreshCw, label: "Cancel anytime" },
];

export function PlansView() {
  return (
    <div className="plans-page py-2">
      <PlansHeader />
      <div className="mx-auto mt-12 grid w-full max-w-5xl gap-5 md:grid-cols-3 md:items-center">
        {plans.map((plan, index) => (
          <PlanCard key={plan.id} plan={plan} index={index} />
        ))}
      </div>
      <PlansFooter />
    </div>
  );
}

function PlansHeader() {
  return (
    <header className="plans-enter mx-auto max-w-2xl text-center">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Simple pricing,
        <br />
        <span className="plans-title-accent">powerful digital signage</span>
      </h1>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
        {trustBadges.map(({ icon: Icon, label }, i) => (
          <span key={label} className="flex items-center gap-1.5">
            {i > 0 && <span className="mr-3 hidden text-muted-foreground/40 sm:inline">·</span>}
            <Icon size={14} className="text-brand" strokeWidth={2} />
            {label}
          </span>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <div className="flex items-center gap-0.5 text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={15} className="fill-current" />
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          Trusted by 1,000+ screens worldwide
        </span>
      </div>
    </header>
  );
}

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const popular = plan.highlighted ?? false;
  const Icon = plan.icon;

  return (
    <div
      className={cn(
        "plan-card plans-enter p-6",
        popular ? "plan-card--popular" : "",
        `plans-enter-${index + 1}`,
      )}
    >
      {popular && plan.badge && (
        <span className="plan-popular-badge absolute right-5 top-5 rounded-full px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider">
          {plan.badge}
        </span>
      )}

      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          popular ? "plan-icon-tile--dark" : "plan-icon-tile",
        )}
      >
        <Icon size={20} strokeWidth={2} />
      </div>

      <div className="mt-5">
        <h2 className={cn("text-lg font-bold", popular ? "text-white" : "text-foreground")}>
          {plan.name}
        </h2>
        <p className={cn("text-sm", popular ? "text-white/60" : "text-muted-foreground")}>
          {plan.tagline}
        </p>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <span className={cn("text-4xl font-bold tracking-tight", popular ? "text-white" : "text-foreground")}>
          ${plan.monthlyPrice}
        </span>
        <span
          className={cn(
            "mb-1 text-lg font-semibold line-through",
            popular ? "plan-price-strike--dark" : "plan-price-strike",
          )}
        >
          ${plan.originalPrice}
        </span>
        <span className={cn("mb-1.5 text-xs font-medium", popular ? "text-white/55" : "text-muted-foreground")}>
          /mo
        </span>
      </div>

      <button
        type="button"
        className={cn(
          "mt-5 h-10 w-full rounded-lg text-sm font-semibold transition-colors",
          popular
            ? "plan-cta-popular"
            : "border border-input bg-background text-foreground hover:border-brand hover:bg-brand hover:text-brand-contrast",
        )}
      >
        {plan.ctaLabel}
      </button>

      <div
        className={cn(
          "mt-5 flex items-center gap-2 text-sm font-medium",
          popular ? "text-white/80" : "text-foreground",
        )}
      >
        <Monitor size={15} className={popular ? "text-white/60" : "text-muted-foreground"} strokeWidth={2} />
        {plan.screens}
      </div>

      <div
        className={cn(
          "my-5 border-t border-dashed",
          popular ? "border-white/15" : "border-border",
        )}
      />

      <ul className="space-y-2.5">
        {plan.features.map((feature) => (
          <li
            key={feature.label}
            className={cn("flex items-center gap-2.5 text-sm", popular ? "text-white/85" : "text-foreground")}
          >
            <Check size={15} className={popular ? "plan-check--dark" : "plan-check"} strokeWidth={2.5} />
            {feature.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlansFooter() {
  return (
    <footer className="plans-enter mx-auto mt-12 max-w-xl space-y-2 text-center text-xs leading-relaxed text-muted-foreground">
      <p className="flex items-center justify-center gap-1.5">
        <ShieldCheck size={13} className="text-brand" strokeWidth={2} />
        Prices in USD. Taxes may apply. 14-day money-back guarantee.
      </p>
      <p>
        Not sure which plan fits? Email us at{" "}
        <a
          href="mailto:aminulislamborhan@gmail.com?subject=OneSign%20plans"
          className="font-medium text-brand-strong underline underline-offset-2"
        >
          aminulislamborhan@gmail.com
        </a>
      </p>
    </footer>
  );
}
