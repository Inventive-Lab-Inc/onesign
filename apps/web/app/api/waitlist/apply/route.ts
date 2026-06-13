import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth/find-user-by-email";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`waitlist:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  let body: {
    email?: string;
    companyName?: string;
    screenCount?: number;
    message?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const companyName = body.companyName?.trim() || null;
  const message = body.message?.trim().slice(0, 1000) || null;
  const screenCount =
    typeof body.screenCount === "number" && body.screenCount >= 1
      ? Math.min(Math.floor(body.screenCount), 9999)
      : null;

  const admin = getSupabaseAdminClient();

  const existingUserId = await findAuthUserIdByEmail(admin, email);
  if (existingUserId) {
    return NextResponse.json(
      {
        error: "An account already exists for this email. Try signing in or reset your password.",
        code: "already_registered",
      },
      { status: 409 },
    );
  }

  const { data: pendingRow } = await admin
    .from("access_waitlist")
    .select("id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingRow) {
    return NextResponse.json({
      ok: true,
      alreadySubmitted: true,
      message: "You're already on the waitlist. The OneSign team will get back to you soon.",
    });
  }

  const { error } = await admin.from("access_waitlist").insert({
    email,
    company_name: companyName,
    screen_count: screenCount,
    message,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({
        ok: true,
        alreadySubmitted: true,
        message: "You're already on the waitlist. The OneSign team will get back to you soon.",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Thanks for applying. The OneSign team will get back to you soon.",
  });
}
