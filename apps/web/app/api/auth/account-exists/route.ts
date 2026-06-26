import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth/find-user-by-email";

export const runtime = "nodejs";

// Lightweight check used only to improve the failed-login message: it tells the
// login form whether to say "wrong password" or "account not found". Supabase's
// signInWithPassword returns the same opaque error for both cases.
export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const existingId = await findAuthUserIdByEmail(admin, email);
    return NextResponse.json({ exists: existingId !== null });
  } catch {
    // On any failure, fall back to "unknown" so the form keeps the generic
    // credential message rather than misleading the user.
    return NextResponse.json({ exists: null });
  }
}
