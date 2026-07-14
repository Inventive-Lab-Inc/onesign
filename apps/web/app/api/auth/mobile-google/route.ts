import { NextResponse, type NextRequest } from "next/server";
import {
  bridgeGoogleUserToSupabase,
  GoogleBridgeError,
} from "@/lib/auth/google-supabase-bridge";
import { issueSupabaseSessionTokensForEmail } from "@/lib/auth/route-handler-account-admin-client";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  error_description?: string;
};

/**
 * Mobile Google sign-in: verify Google ID token → bridge to Supabase → return session tokens.
 * Uses the same identity bridge as the web Auth.js Google flow.
 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`mobile-google:${request.headers.get("x-forwarded-for") ?? "ip"}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  let body: { idToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const idToken = body.idToken?.trim();
  if (!idToken) {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  const expectedAud = process.env.AUTH_GOOGLE_ID?.trim();
  if (!expectedAud) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 503 });
  }

  const tokenRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  const tokenInfo = (await tokenRes.json()) as GoogleTokenInfo;
  if (!tokenRes.ok || tokenInfo.error_description) {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }
  if (tokenInfo.aud !== expectedAud) {
    return NextResponse.json({ error: "Google token audience mismatch" }, { status: 401 });
  }
  const emailVerified =
    tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
  if (!tokenInfo.sub || !tokenInfo.email || !emailVerified) {
    return NextResponse.json({ error: "Google account email is not verified" }, { status: 401 });
  }

  try {
    await bridgeGoogleUserToSupabase({
      googleSub: tokenInfo.sub,
      email: tokenInfo.email,
      name: tokenInfo.name,
      image: tokenInfo.picture,
    });
    const session = await issueSupabaseSessionTokensForEmail(tokenInfo.email);
    return NextResponse.json({
      ...session,
      user: { email: tokenInfo.email, name: tokenInfo.name ?? null },
    });
  } catch (error) {
    const message =
      error instanceof GoogleBridgeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Google sign-in failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
