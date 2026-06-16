import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
  ],
};
