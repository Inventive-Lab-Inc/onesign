import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getAppOrigin, isAppOnlyPath, isMarketingHost } from "@/lib/site-hosts";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const { pathname, search } = request.nextUrl;

  if (isMarketingHost(host) && isAppOnlyPath(pathname)) {
    const target = new URL(`${pathname}${search}`, getAppOrigin());
    return NextResponse.redirect(target);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/screens/:path*",
    "/devices/:path*",
    "/groups/:path*",
    "/playlists/:path*",
    "/content/:path*",
    "/websites/:path*",
    "/media/:path*",
    "/dashboard/:path*",
    "/account/:path*",
    "/profile/:path*",
    "/download-app/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/account-suspended",
    "/trial-expired",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/accept-invite",
    "/auth/:path*",
    "/display/:path*",
    "/plans",
    "/plans/:path*",
  ],
};
