import { NextResponse, type NextRequest } from "next/server";
import { getRouteHandlerClientAuth } from "@/lib/auth/route-handler-client";
import { isStripeConfigured } from "@/lib/stripe/config";
import { fetchAccountContext, type AccountContext } from "@/lib/workspace/account-context";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type StripeAccountAdminAuth = {
  supabase: SupabaseClient;
  user: User;
  account: AccountContext;
  isMobileClient: boolean;
};

/** Cookie session (web) or Bearer token (mobile) + account-admin gate. */
export async function requireStripeAccountAdmin(
  request: NextRequest,
): Promise<StripeAccountAdminAuth | NextResponse> {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const ctx = await getRouteHandlerClientAuth(request);
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await fetchAccountContext(ctx.supabase, ctx.user.id);
  if (!account.canAdminAccount) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    supabase: ctx.supabase,
    user: ctx.user,
    account,
    isMobileClient: request.headers.get("x-onesign-client")?.trim().toLowerCase() === "mobile",
  };
}
