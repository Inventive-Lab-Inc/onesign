import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/signup") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("notice", "invite_only");
    return NextResponse.redirect(loginUrl);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/devices/:path*",
    "/playlists/:path*",
    "/media/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/account-suspended",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/accept-invite",
  ],
};
