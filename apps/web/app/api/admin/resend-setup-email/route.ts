import { NextResponse, type NextRequest } from "next/server";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { sendPasswordSetupEmail } from "@/lib/auth/send-password-setup-email";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, staff } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    await sendPasswordSetupEmail(email);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send the email";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: `Set-password email resent to ${email}.`,
  });
}
