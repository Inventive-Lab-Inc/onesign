export type SignupPlanSlug = "solo" | "growth" | "network";

/** All signups start a 14-day Solo trial; plan slug is optional intent for future billing. */
export function buildSignupHref(_plan?: SignupPlanSlug | string | null): string {
  return "/signup";
}

export function parseSignupPlanSlug(value: string | null | undefined): SignupPlanSlug | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "solo" || normalized === "growth" || normalized === "network") {
    return normalized;
  }
  return null;
}
