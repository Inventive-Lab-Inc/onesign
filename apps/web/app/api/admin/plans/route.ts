import { NextResponse, type NextRequest } from "next/server";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { MIN_STORAGE_LIMIT_BYTES } from "@/lib/plan-quota";

export const runtime = "nodejs";

type UpsertBody = {
  id?: string | null;
  name?: string;
  tagline?: string;
  deviceLimit?: number;
  storageLimitBytes?: number;
  monthlyPriceCents?: number;
  originalPriceCents?: number | null;
  monthlyPriceGbpCents?: number;
  originalPriceGbpCents?: number | null;
  monthlyPriceEurCents?: number;
  originalPriceEurCents?: number | null;
  monthlyPriceBdtPaisa?: number;
  originalPriceBdtPaisa?: number | null;
  ctaLabel?: string;
  features?: string[];
  badge?: string | null;
  isHighlighted?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function optionalPositiveInt(value: unknown): number | null {
  if (value == null) return null;
  return isPositiveInt(value) ? value : null;
}

export async function POST(request: NextRequest) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: UpsertBody;
  try {
    body = (await request.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Plan name is required" }, { status: 400 });
  }

  if (typeof body.deviceLimit !== "number" || !Number.isInteger(body.deviceLimit) || body.deviceLimit < 1) {
    return NextResponse.json({ error: "Screen limit must be an integer of at least 1" }, { status: 400 });
  }

  if (
    typeof body.storageLimitBytes !== "number" ||
    !Number.isInteger(body.storageLimitBytes) ||
    body.storageLimitBytes < MIN_STORAGE_LIMIT_BYTES
  ) {
    return NextResponse.json(
      { error: `Storage limit must be at least ${MIN_STORAGE_LIMIT_BYTES} bytes` },
      { status: 400 },
    );
  }

  if (!isPositiveInt(body.monthlyPriceCents)) {
    return NextResponse.json({ error: "USD monthly price must be a whole number of cents" }, { status: 400 });
  }

  if (!isPositiveInt(body.monthlyPriceGbpCents)) {
    return NextResponse.json({ error: "GBP monthly price must be a whole number of pence" }, { status: 400 });
  }

  if (!isPositiveInt(body.monthlyPriceEurCents)) {
    return NextResponse.json({ error: "EUR monthly price must be a whole number of cents" }, { status: 400 });
  }

  if (!isPositiveInt(body.monthlyPriceBdtPaisa)) {
    return NextResponse.json({ error: "BDT monthly price must be a whole number of paisa" }, { status: 400 });
  }

  const features = Array.isArray(body.features)
    ? body.features.map((feature) => feature.trim()).filter((feature) => feature.length > 0)
    : [];

  const { data, error } = await supabase.rpc("admin_upsert_plan", {
    p_id: body.id?.trim() || null,
    p_name: name,
    p_tagline: body.tagline?.trim() ?? "",
    p_device_limit: body.deviceLimit,
    p_storage_limit_bytes: body.storageLimitBytes,
    p_monthly_price_cents: body.monthlyPriceCents,
    p_original_price_cents: optionalPositiveInt(body.originalPriceCents),
    p_monthly_price_gbp_cents: body.monthlyPriceGbpCents,
    p_original_price_gbp_cents: optionalPositiveInt(body.originalPriceGbpCents),
    p_monthly_price_eur_cents: body.monthlyPriceEurCents,
    p_original_price_eur_cents: optionalPositiveInt(body.originalPriceEurCents),
    p_monthly_price_bdt_paisa: body.monthlyPriceBdtPaisa,
    p_original_price_bdt_paisa: optionalPositiveInt(body.originalPriceBdtPaisa),
    p_cta_label: body.ctaLabel?.trim() || "Choose plan",
    p_features: features,
    p_badge: body.badge?.trim() || null,
    p_is_highlighted: Boolean(body.isHighlighted),
    p_is_active: body.isActive ?? true,
    p_sort_order: isPositiveInt(body.sortOrder) ? body.sortOrder : 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan: data });
}
