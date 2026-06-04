/** Public origin for auth redirects (password reset, email confirm). */
export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (typeof window !== "undefined") return window.location.origin;

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

export function getPasswordResetRedirectUrl(): string {
  const next = encodeURIComponent("/reset-password");
  return `${getAppUrl()}/auth/confirm?next=${next}`;
}
