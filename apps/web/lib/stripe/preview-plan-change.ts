import type Stripe from "stripe";
import { findLiveSubscription } from "@/lib/stripe/change-subscription";

export type PlanChangeMode = "new_checkout" | "plan_switch";
export type PlanChangeDirection = "upgrade" | "downgrade" | "subscribe" | "same";

export type PlanChangePreview = {
  mode: PlanChangeMode;
  direction: PlanChangeDirection;
  targetPlanName: string;
  currentPlanName: string | null;
  /** Catalog price for the target plan (monthly or annual monthly equivalent display is caller's job). */
  targetPriceCents: number;
  currency: string;
  /** Positive = charge soon; negative magnitude as creditCents. */
  amountDueCents: number;
  creditCents: number;
  /** Unix seconds when the next renewal is expected, if known. */
  nextRenewalAt: number | null;
};

function directionFromLimits(currentLimit: number | null, targetLimit: number): PlanChangeDirection {
  if (currentLimit == null) return "subscribe";
  if (targetLimit > currentLimit) return "upgrade";
  if (targetLimit < currentLimit) return "downgrade";
  return "same";
}

/** Format USD/cents for short user-facing copy. */
export function formatBillingMoney(cents: number, currency = "usd"): string {
  const amount = Math.abs(cents) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
  }
}

export type PlanChangeConfirmCopy = {
  title: string;
  bullets: string[];
  confirmLabel: string;
};

/** Plain-language confirm copy shared by web + mobile wording. */
export function buildPlanChangeConfirmCopy(preview: PlanChangePreview): PlanChangeConfirmCopy {
  const target = preview.targetPlanName;
  const price = formatBillingMoney(preview.targetPriceCents, preview.currency);

  if (preview.mode === "new_checkout") {
    return {
      title: `Pay for ${target}?`,
      bullets: [
        `You’ll go to the secure payment page to pay ${price}/mo for ${target}.`,
        "Your plan starts after payment goes through.",
      ],
      confirmLabel: "Continue to payment",
    };
  }

  const current = preview.currentPlanName ?? "your current plan";

  if (preview.direction === "downgrade") {
    const bullets = [
      `You’re moving from ${current} to ${target}.`,
      "You’ll get credit for unused days (used on future bills — usually not an instant refund to your bank).",
    ];
    if (preview.creditCents > 0) {
      bullets.push(`About ${formatBillingMoney(preview.creditCents, preview.currency)} credit expected.`);
    }
    bullets.push(`Your plan limits change right away. From next month you’ll pay ${price}/mo.`);
    return {
      title: `Switch to ${target}?`,
      bullets,
      confirmLabel: "Confirm switch",
    };
  }

  // upgrade or same-tier switch (e.g. monthly↔annual handled as upgrade wording)
  const bullets = [
    `You’re moving from ${current} to ${target}.`,
    "We’ll charge the difference for the days left this month on your saved card.",
  ];
  if (preview.amountDueCents > 0) {
    bullets.push(`About ${formatBillingMoney(preview.amountDueCents, preview.currency)} due today.`);
  } else if (preview.amountDueCents === 0 && preview.creditCents === 0) {
    bullets.push("No extra charge expected today.");
  }
  bullets.push(`From next month you’ll pay ${price}/mo.`);

  return {
    title: preview.direction === "same" ? `Switch to ${target}?` : `Upgrade to ${target}?`,
    bullets,
    confirmLabel: preview.direction === "same" ? "Confirm switch" : "Confirm upgrade",
  };
}

export async function previewPlanChange(params: {
  stripe: Stripe;
  customerId: string | null;
  knownSubscriptionId?: string | null;
  targetPriceId: string;
  targetPlanName: string;
  targetPriceCents: number;
  currentPlanName: string | null;
  currentDeviceLimit: number | null;
  targetDeviceLimit: number;
}): Promise<PlanChangePreview> {
  const direction = directionFromLimits(params.currentDeviceLimit, params.targetDeviceLimit);
  const subscribePreview = (): PlanChangePreview => ({
    mode: "new_checkout",
    direction: "subscribe",
    targetPlanName: params.targetPlanName,
    currentPlanName: params.currentPlanName,
    targetPriceCents: params.targetPriceCents,
    currency: "usd",
    amountDueCents: 0,
    creditCents: 0,
    nextRenewalAt: null,
  });

  // First payment / trial with no live sub → Checkout.
  if (!params.customerId) {
    return subscribePreview();
  }

  const live = await findLiveSubscription(
    params.stripe,
    params.customerId,
    params.knownSubscriptionId,
  );

  if (!live) {
    return subscribePreview();
  }

  const item = live.items.data[0];
  if (!item?.id) {
    return subscribePreview();
  }

  let amountDueCents = 0;
  let creditCents = 0;
  let currency = "usd";
  let nextRenewalAt: number | null =
    typeof item.current_period_end === "number" ? item.current_period_end : null;

  try {
    const invoice = await params.stripe.invoices.createPreview({
      customer: params.customerId,
      subscription: live.id,
      subscription_details: {
        items: [{ id: item.id, price: params.targetPriceId }],
        proration_behavior: "create_prorations",
      },
    });

    currency = (invoice.currency || "usd").toLowerCase();
    amountDueCents = invoice.amount_due ?? 0;
    if (amountDueCents < 0) {
      creditCents = Math.abs(amountDueCents);
      amountDueCents = 0;
    }

    // Prefer credit from customer balance / ending balance when amount_due is 0.
    if (amountDueCents === 0 && creditCents === 0) {
      const ending = invoice.ending_balance ?? 0;
      const starting = invoice.starting_balance ?? 0;
      // Stripe balances: negative = customer credit.
      if (ending < starting) {
        creditCents = Math.max(0, starting - ending);
      }
    }

    if (typeof invoice.next_payment_attempt === "number") {
      nextRenewalAt = invoice.next_payment_attempt;
    } else if (typeof item.current_period_end === "number") {
      nextRenewalAt = item.current_period_end;
    }
  } catch {
    // Soft fail — still show switch confirm without exact dollars.
  }

  return {
    mode: "plan_switch",
    direction,
    targetPlanName: params.targetPlanName,
    currentPlanName: params.currentPlanName,
    targetPriceCents: params.targetPriceCents,
    currency,
    amountDueCents,
    creditCents,
    nextRenewalAt,
  };
}
