/** Hostnames that serve the public marketing site (landing, pricing). */
export const MARKETING_HOSTS = new Set(["onesigntv.com", "www.onesigntv.com"]);

/** Hostnames that serve the browser-based signage player. */
export const PLAYER_HOSTS = new Set(["player.onesigntv.com"]);

/** App-only routes — marketing host visitors are redirected to the app origin. */
export const APP_ONLY_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/screens",
  "/devices",
  "/groups",
  "/playlists",
  "/content",
  "/websites",
  "/media",
  "/dashboard",
  "/account",
  "/profile",
  "/download-app",
  "/settings",
  "/admin",
  "/account-suspended",
  "/trial-expired",
  "/display",
  "/plans",
] as const;

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? "";
}

export function isMarketingHost(host: string | null | undefined): boolean {
  return MARKETING_HOSTS.has(normalizeHost(host));
}

export function isPlayerHost(host: string | null | undefined): boolean {
  return PLAYER_HOSTS.has(normalizeHost(host));
}

export function isAppOnlyPath(pathname: string): boolean {
  return APP_ONLY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getAppOrigin(): string {
  const fromEnv =
    process.env.AUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://app.onesigntv.com";
}

function isLoopbackHost(host: string | null | undefined): boolean {
  const hostname = normalizeHost(host);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Absolute origin for redirects behind a reverse proxy.
 * Next.js `request.url` becomes `https://localhost:PORT` when the process binds
 * to 127.0.0.1 — never use that for Location headers.
 */
export function publicOriginFromRequest(request: {
  headers: Headers;
  url: string;
}): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim();
  const host = forwardedHost || hostHeader;

  if (host && !isLoopbackHost(host)) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  return getAppOrigin();
}

/** Build an absolute URL on the public origin (never loopback). */
export function publicUrl(
  request: { headers: Headers; url: string },
  path: string,
): URL {
  const origin = publicOriginFromRequest(request);
  return new URL(path, origin.endsWith("/") ? origin : `${origin}/`);
}

export function getMarketingOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MARKETING_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://onesigntv.com";
}

export function getPlayerOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PLAYER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://player.onesigntv.com";
}

export function playerUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getPlayerOrigin()}${normalized}`;
}

export function appUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getAppOrigin()}${normalized}`;
}
