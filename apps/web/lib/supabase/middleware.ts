import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConnectEnv } from "./env";

const PROTECTED_PREFIXES = ["/devices", "/playlists", "/media", "/dashboard", "/profile", "/settings"];

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
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const needsAuthCheck =
    isProtectedPath(pathname) || pathname === "/login" || pathname === "/signup";

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
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error) {
      userId = data?.claims?.sub;
    }
  } catch {
    // Auth unreachable — fail closed on protected routes only.
  }

  if (isProtectedPath(pathname) && !userId) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if ((pathname === "/login" || pathname === "/signup") && userId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
