import { NextResponse } from "next/server";
import { signOut as signOutAuthJs } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  await signOutAuthJs({ redirect: false });
  return NextResponse.json({ ok: true });
}
