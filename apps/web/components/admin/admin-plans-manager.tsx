"use client";

import type { PlanTemplate } from "@signage/types";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Monitor,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { ConfirmModal } from "@/components/shell/confirm-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type StorageUnit,
  bytesToStorageUnit,
  formatStorageBytes,
  parseStorageInput,
} from "@/lib/plan-quota";
import { cn } from "@/lib/utils";

type PlanFormState = {
  id: string | null;
  name: string;
  tagline: string;
  monthlyPrice: string;
  originalPrice: string;
  ctaLabel: string;
  deviceLimit: string;
  storageValue: string;
  storageUnit: StorageUnit;
  features: string;
  badge: string;
  isHighlighted: boolean;
  isActive: boolean;
  sortOrder: number;
};

function emptyForm(): PlanFormState {
  return {
    id: null,
    name: "",
    tagline: "",
    monthlyPrice: "",
    originalPrice: "",
    ctaLabel: "Choose plan",
    deviceLimit: "1",
    storageValue: "1",
    storageUnit: "GB",
    features: "",
    badge: "",
    isHighlighted: false,
    isActive: true,
    sortOrder: 0,
  };
}

function planToForm(plan: PlanTemplate): PlanFormState {
  const useGb = plan.storage_limit_bytes >= 1024 ** 3;
  const unit: StorageUnit = useGb ? "GB" : "MB";
  const storageValue = bytesToStorageUnit(plan.storage_limit_bytes, unit);
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    monthlyPrice: centsToInput(plan.monthly_price_cents),
    originalPrice: plan.original_price_cents == null ? "" : centsToInput(plan.original_price_cents),
    ctaLabel: plan.cta_label,
    deviceLimit: String(plan.device_limit),
    storageValue: useGb ? storageValue.toFixed(storageValue % 1 === 0 ? 0 : 1) : String(Math.round(storageValue)),
    storageUnit: unit,
    features: plan.features.join("\n"),
    badge: plan.badge ?? "",
    isHighlighted: plan.is_highlighted,
    isActive: plan.is_active,
    sortOrder: plan.sort_order,
  };
}

function centsToInput(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

function formatPriceCents(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

function formatScreens(limit: number): string {
  return `${limit} screen${limit === 1 ? "" : "s"}`;
}

async function savePlan(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch("/api/admin/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to save plan");
  }
}

function planToPayload(plan: PlanTemplate): Record<string, unknown> {
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    deviceLimit: plan.device_limit,
    storageLimitBytes: plan.storage_limit_bytes,
    monthlyPriceCents: plan.monthly_price_cents,
    originalPriceCents: plan.original_price_cents,
    ctaLabel: plan.cta_label,
    features: plan.features,
    badge: plan.badge,
    isHighlighted: plan.is_highlighted,
    isActive: plan.is_active,
    sortOrder: plan.sort_order,
  };
}

export function AdminPlansManager({ plans }: { plans: PlanTemplate[] }) {
  const router = useRouter();
  const { canWrite } = useAdminStaff();
  const [editing, setEditing] = useState<PlanFormState | null>(null);
  const [planPendingDelete, setPlanPendingDelete] = useState<PlanTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  async function toggleActive(plan: PlanTemplate) {
    setBusyId(plan.id);
    try {
      await savePlan({ ...planToPayload(plan), isActive: !plan.is_active });
      toast.success(plan.is_active ? `${plan.name} hidden from pricing` : `${plan.name} published`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update plan");
    } finally {
      setBusyId(null);
    }
  }

  async function move(plan: PlanTemplate, direction: -1 | 1) {
    const index = plans.findIndex((candidate) => candidate.id === plan.id);
    const neighbor = plans[index + direction];
    if (!neighbor) return;

    setBusyId(plan.id);
    try {
      await Promise.all([
        savePlan({ ...planToPayload(plan), sortOrder: neighbor.sort_order }),
        savePlan({ ...planToPayload(neighbor), sortOrder: plan.sort_order }),
      ]);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder plans");
    } finally {
      setBusyId(null);
    }
  }

  async function deletePlan() {
    if (!planPendingDelete || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/plans/${planPendingDelete.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to delete plan");
      }
      toast.success(`${planPendingDelete.name} deleted`);
      setPlanPendingDelete(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete plan");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => setEditing(emptyForm())}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            New plan
          </Button>
        </div>
      ) : null}

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/90 bg-card p-10 text-center text-sm text-muted-foreground">
          No plans yet. {canWrite ? "Create your first plan to publish pricing." : ""}
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan, index) => (
            <li
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-4 shadow-sm",
                plan.is_active ? "border-border/90" : "border-dashed border-border/70 opacity-75",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-foreground">{plan.name}</h2>
                    {plan.is_highlighted ? (
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-strong" aria-label="Highlighted" />
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{plan.tagline || "—"}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide",
                    plan.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground",
                  )}
                >
                  {plan.is_active ? "Live" : "Hidden"}
                </span>
              </div>

              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {formatPriceCents(plan.monthly_price_cents)}
                </span>
                {plan.original_price_cents != null && plan.original_price_cents > plan.monthly_price_cents ? (
                  <span className="mb-0.5 text-sm font-medium text-muted-foreground line-through">
                    {formatPriceCents(plan.original_price_cents)}
                  </span>
                ) : null}
                <span className="mb-1 text-xs text-muted-foreground">/mo</span>
              </div>

              <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5" aria-hidden />
                  <dt className="sr-only">Screens</dt>
                  <dd>{formatScreens(plan.device_limit)}</dd>
                </div>
                <div>
                  <dt className="sr-only">Storage</dt>
                  <dd>{formatStorageBytes(plan.storage_limit_bytes)} storage</dd>
                </div>
              </dl>

              {plan.features.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {plan.features.length} feature{plan.features.length === 1 ? "" : "s"}
                </p>
              ) : null}

              {canWrite ? (
                <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      aria-label={`Move ${plan.name} up`}
                      disabled={index === 0 || busyId !== null}
                      onClick={() => void move(plan, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      aria-label={`Move ${plan.name} down`}
                      disabled={index === plans.length - 1 || busyId !== null}
                      onClick={() => void move(plan, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      disabled={busyId !== null}
                      onClick={() => void toggleActive(plan)}
                    >
                      {plan.is_active ? "Hide" : "Publish"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      aria-label={`Edit ${plan.name}`}
                      disabled={busyId !== null}
                      onClick={() => setEditing(planToForm(plan))}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${plan.name}`}
                      disabled={busyId !== null}
                      onClick={() => setPlanPendingDelete(plan)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <PlanEditorModal
          form={editing}
          existingCount={plans.length}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}

      <ConfirmModal
        open={planPendingDelete !== null}
        title={planPendingDelete ? `Delete ${planPendingDelete.name}?` : "Delete plan?"}
        message="This removes the plan from the catalog and the pricing page. Clients already on these limits keep them."
        confirmLabel={deleting ? "Deleting…" : "Delete plan"}
        cancelLabel="Cancel"
        variant="danger"
        onClose={() => !deleting && setPlanPendingDelete(null)}
        onConfirm={() => void deletePlan()}
      />
    </div>
  );
}

function PlanEditorModal({
  form: initialForm,
  existingCount,
  onClose,
  onSaved,
}: {
  form: PlanFormState;
  existingCount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PlanFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const isNew = form.id == null;

  function update<K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeStorageUnit(next: StorageUnit) {
    if (next === form.storageUnit) return;
    const bytes = parseStorageInput(form.storageValue, form.storageUnit);
    if (bytes != null) {
      const value = bytesToStorageUnit(bytes, next);
      update("storageValue", next === "GB" ? String(Number(value.toFixed(1))) : String(Math.round(value)));
    }
    update("storageUnit", next);
  }

  async function submit() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Plan name is required");
      return;
    }
    const deviceLimit = Number.parseInt(form.deviceLimit, 10);
    if (!Number.isInteger(deviceLimit) || deviceLimit < 1) {
      toast.error("Screen limit must be at least 1");
      return;
    }
    const storageBytes = parseStorageInput(form.storageValue, form.storageUnit);
    if (storageBytes == null || storageBytes < 1024 ** 2) {
      toast.error("Storage limit must be at least 1 MB");
      return;
    }
    const monthly = Number.parseFloat(form.monthlyPrice);
    if (!Number.isFinite(monthly) || monthly < 0) {
      toast.error("Enter a valid monthly price");
      return;
    }
    const original = form.originalPrice.trim() === "" ? null : Number.parseFloat(form.originalPrice);
    if (original != null && (!Number.isFinite(original) || original < 0)) {
      toast.error("Enter a valid original price or leave it blank");
      return;
    }

    const features = form.features
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    setSaving(true);
    try {
      await savePlan({
        id: form.id,
        name,
        tagline: form.tagline.trim(),
        deviceLimit,
        storageLimitBytes: storageBytes,
        monthlyPriceCents: Math.round(monthly * 100),
        originalPriceCents: original == null ? null : Math.round(original * 100),
        ctaLabel: form.ctaLabel.trim() || "Choose plan",
        features,
        badge: form.badge.trim() || null,
        isHighlighted: form.isHighlighted,
        isActive: form.isActive,
        sortOrder: isNew ? existingCount : form.sortOrder,
      });
      toast.success(isNew ? "Plan created" : "Plan updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Create plan" : `Edit ${form.name}`}
        className="relative w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{isNew ? "New plan" : "Edit plan"}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Business"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-tagline">Tagline</Label>
              <Input
                id="plan-tagline"
                value={form.tagline}
                onChange={(event) => update("tagline", event.target.value)}
                placeholder="For growing teams"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Monthly price (USD)</Label>
              <Input
                id="plan-price"
                inputMode="decimal"
                value={form.monthlyPrice}
                onChange={(event) => update("monthlyPrice", event.target.value.replace(/[^\d.]/g, ""))}
                placeholder="59"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-original">Original price (optional)</Label>
              <Input
                id="plan-original"
                inputMode="decimal"
                value={form.originalPrice}
                onChange={(event) => update("originalPrice", event.target.value.replace(/[^\d.]/g, ""))}
                placeholder="79"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-screens">Screen limit</Label>
              <Input
                id="plan-screens"
                inputMode="numeric"
                value={form.deviceLimit}
                onChange={(event) => update("deviceLimit", event.target.value.replace(/[^\d]/g, ""))}
                placeholder="5"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="plan-storage">Storage limit</Label>
                <div
                  className="inline-flex overflow-hidden rounded-md border border-input text-[0.6875rem] font-semibold"
                  role="group"
                  aria-label="Storage unit"
                >
                  {(["MB", "GB"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => changeStorageUnit(unit)}
                      aria-pressed={form.storageUnit === unit}
                      className={cn(
                        "px-2 py-0.5 transition",
                        form.storageUnit === unit
                          ? "bg-brand-strong text-white"
                          : "bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                id="plan-storage"
                inputMode="decimal"
                value={form.storageValue}
                onChange={(event) => update("storageValue", event.target.value.replace(/[^\d.]/g, ""))}
                placeholder="25"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-features">Features (one per line)</Label>
            <textarea
              id="plan-features"
              value={form.features}
              onChange={(event) => update("features", event.target.value)}
              rows={5}
              placeholder={"25 GB media storage\nScreen groups & bulk deploy\nPriority email support"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-cta">Button label</Label>
              <Input
                id="plan-cta"
                value={form.ctaLabel}
                onChange={(event) => update("ctaLabel", event.target.value)}
                placeholder="Choose Business"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-badge">Badge (optional)</Label>
              <Input
                id="plan-badge"
                value={form.badge}
                onChange={(event) => update("badge", event.target.value)}
                placeholder="MOST POPULAR"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isHighlighted}
                onChange={(event) => update("isHighlighted", event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Highlight as featured
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => update("isActive", event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Show on pricing page
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create plan" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
