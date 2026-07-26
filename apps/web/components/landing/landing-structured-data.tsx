import type { PlanViewModel } from "@/components/plans/plan-data";

interface SoftwareApplicationSchema {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  name: string;
  applicationCategory: string;
  operatingSystem: string;
  description: string;
  offers: OfferSchema[];
}

interface OfferSchema {
  "@type": "Offer";
  name: string;
  price: string;
  priceCurrency: string;
  priceValidUntil?: string;
  availability: string;
  url: string;
}

function buildOffersFromPlans(plans: PlanViewModel[]): OfferSchema[] {
  return plans
    .filter((plan) => !plan.isFree)
    .map((plan) => ({
      "@type": "Offer" as const,
      name: `${plan.name} Plan`,
      price: plan.monthlyPrice.toString(),
      priceCurrency: plan.currency,
      availability: "https://schema.org/InStock",
      url: "https://onesigntv.com/#pricing",
    }));
}

export function LandingStructuredData({ plans }: { plans: PlanViewModel[] }) {
  const schema: SoftwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "OneSign",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Android, Web",
    description:
      "Digital signage software to manage every TV screen from one dashboard. Build playlists, schedule menus and promos, and publish instantly across all locations.",
    offers: buildOffersFromPlans(plans),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
