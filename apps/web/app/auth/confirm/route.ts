import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/site-hosts";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/reset-password";

  const redirectTo = publicUrl(request, safeNext);

  const supabase = getSupabaseServerClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  const loginUrl = publicUrl(request, "/login");
  loginUrl.searchParams.set("error", "auth_confirm_failed");
  return NextResponse.redirect(loginUrl);
}
