/** Public origin for auth redirects (password reset, email confirm). */
export function getAppUrl(): string {
  // Prefer the active browser origin so multi-domain deploys (.bd / .co.uk) stay correct.
  if (typeof window !== "undefined") return window.location.origin;

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

export function getPasswordResetRedirectUrl(): string {
  return getOAuthConfirmRedirectUrl("/reset-password");
}

/** Email/password recovery links return to /auth/confirm for PKCE code exchange. */
export function getOAuthConfirmRedirectUrl(nextPath = "/dashboard"): string {
  const next = encodeURIComponent(nextPath);
  return `${getAppUrl()}/auth/confirm?next=${next}`;
}

/** Auth.js Google sign-in completes at /auth/google/complete, then bridges to Supabase. */
export function getGoogleAuthCallbackUrl(nextPath = "/dashboard"): string {
  const next = encodeURIComponent(nextPath);
  // Relative URL — Auth.js rejects absolute callback URLs on a different origin than the
  // active request (e.g. NEXT_PUBLIC_APP_URL baked as .co.uk while users visit .bd).
  return `/auth/google/complete?next=${next}`;
}

/** Self-serve signup confirmation lands on the dashboard. */
export function getSignupConfirmRedirectUrl(): string {
  return getOAuthConfirmRedirectUrl("/dashboard");
}

/** Admin invite emails land on /auth/confirm then /auth/accept-invite to set a password. */
export function getInviteAcceptRedirectUrl(): string {
  return getOAuthConfirmRedirectUrl("/auth/accept-invite");
}
