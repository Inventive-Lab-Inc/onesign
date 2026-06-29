import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtAppMetadataFlag } from "@/lib/auth/jwt-app-metadata";
import { isTrialExpired } from "@/lib/trial";
import { getSupabaseConnectEnv } from "./env";

const PROTECTED_PREFIXES = ["/screens", "/devices", "/groups", "/playlists", "/content", "/media", "/dashboard", "/account", "/profile", "/download-app", "/settings", "/admin"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"));
}

/**
 * Refreshes the session cookie when needed and returns the response to continue the request.
 * Uses getClaims() (local JWT validation) instead of getSession()/getUser() network calls.
 */
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/accept-invite"];

/** Skip live profile DB read when a recent gate check cookie matches this user. */
const PROFILE_GATE_COOKIE = "profile-gate";
const PROFILE_GATE_TTL_MS = 120_000;

type ProfileGateCache = {
  uid: string;
  ts: number;
  disabled: boolean;
  trialExpired: boolean;
};

function readProfileGateCache(request: NextRequest, userId: string): ProfileGateCache | null {
  const raw = request.cookies.get(PROFILE_GATE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProfileGateCache;
    if (parsed.uid !== userId) return null;
    if (Date.now() - parsed.ts > PROFILE_GATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeProfileGateCookie(
  response: NextResponse,
  userId: string,
  disabled: boolean,
  trialExpired: boolean,
): void {
  const payload: ProfileGateCache = {
    uid: userId,
    ts: Date.now(),
    disabled,
    trialExpired,
  };
  response.cookies.set(PROFILE_GATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.ceil(PROFILE_GATE_TTL_MS / 1000),
    path: "/",
  });
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const needsAuthCheck =
    isProtectedPath(pathname) || AUTH_ROUTES.some((route) => pathname === route);

  if (!needsAuthCheck) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  if (!hasSupabaseAuthCookie(request)) {
    if (isProtectedPath(pathname)) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const connect = getSupabaseConnectEnv();
  if (!connect) {
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(connect.url, connect.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let userId: string | undefined;
  let appMetadata: unknown;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error) {
      userId = data?.claims?.sub;
      appMetadata = data?.claims?.app_metadata;
    }
  } catch {
    // Auth unreachable — fail closed on protected routes only.
  }

  if (isProtectedPath(pathname) && !userId) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (userId) {
    const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

    if (isAdminRoute) {
      const jwtStaff = jwtAppMetadataFlag(appMetadata, "is_platform_staff");
      if (jwtStaff === true) {
        // JWT flag set by sync_user_app_metadata — skip DB round-trip.
      } else {
        const { data: staffRow } = await supabase
          .from("platform_staff")
          .select("user_id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (!staffRow) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }
    } else if (isProtectedPath(pathname) && pathname !== "/account-suspended" && pathname !== "/trial-expired") {
      const cached = readProfileGateCache(request, userId);
      if (cached) {
        if (cached.disabled) {
          return NextResponse.redirect(new URL("/account-suspended", request.url));
        }
        if (cached.trialExpired) {
          return NextResponse.redirect(new URL("/trial-expired", request.url));
        }
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_disabled, trial_ends_at")
          .eq("id", userId)
          .maybeSingle();

        const disabled = Boolean(profile?.is_disabled);
        const trialExpired = isTrialExpired(profile?.trial_ends_at);

        if (disabled) {
          return NextResponse.redirect(new URL("/account-suspended", request.url));
        }

        if (trialExpired) {
          return NextResponse.redirect(new URL("/trial-expired", request.url));
        }

        writeProfileGateCookie(response, userId, disabled, trialExpired);
      }
    }
  }

  if ((pathname === "/login" || pathname === "/signup") && userId) {
    const next = request.nextUrl.searchParams.get("next");
    const safeNext =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return response;
}
