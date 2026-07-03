import { isMarketingHost, normalizeHost } from "@/lib/site-hosts";

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function getClarityProjectIdForHost(host: string | null | undefined): string | undefined {
  const marketingProjectId = firstNonEmpty(
    process.env.NEXT_PUBLIC_CLARITY_MARKETING_PROJECT_ID,
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
  );
  const appProjectId = process.env.NEXT_PUBLIC_CLARITY_APP_PROJECT_ID?.trim();

  if (isMarketingHost(host)) return marketingProjectId;
  if (normalizeHost(host) === "app.onesigntv.com") return appProjectId || undefined;

  return undefined;
}
