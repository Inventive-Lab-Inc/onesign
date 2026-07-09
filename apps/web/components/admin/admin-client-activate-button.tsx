"use client";

import type { AdminUserDirectoryEntry, PlanTemplate } from "@signage/types";
import { Loader2, Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import {
  CLIENT_PLAN_CUSTOM_VALUE,
  CLIENT_PLAN_TRIAL_VALUE,
  findSoloPlan,
  type ClientProvisioningMode,
} from "@/lib/admin/client-provisioning";
import { guessClientPlanSelection } from "@/lib/admin/client-plan-label";
import {
  DEFAULT_TRIAL_DAYS,
  formatStorageBytes,
  parseStorageInput,
  type StorageUnit,
} from "@/lib/plan-quota";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

function planLimitsLabel(deviceLimit: number, storageLimitBytes: number): string {
  return `${deviceLimit} screen${deviceLimit === 1 ? "" : "s"} · ${formatStorageBytes(storageLimitBytes)} storage`;
}

export function AdminClientActivateButton({
  client,
  plans,
}: {
  client: Pick<
    AdminUserDirectoryEntry,
    | "id"
    | "email"
    | "client_name"
    | "device_limit"
    | "storage_limit_bytes"
    | "trial_ends_at"
    | "trial_expired"
    | "plan_kind"
  >;
  plans: PlanTemplate[];
}) {
  const router = useRouter();
  const { canWrite } = useAdminStaff();
  const defaultPlanId = plans[0]?.id ?? CLIENT_PLAN_CUSTOM_VALUE;

  const [open, setOpen] = useState(false);
  const [planSelection, setPlanSelection] = useState(defaultPlanId);
  const [trialDays, setTrialDays] = useState(String(DEFAULT_TRIAL_DAYS));
  const [deviceLimit, setDeviceLimit] = useState(String(client.device_limit));
  const [storageValue, setStorageValue] = useState("500");
  const [storageUnit, setStorageUnit] = useState<StorageUnit>("MB");
  const [loading, setLoading] = useState(false);

  const provisioningMode: ClientProvisioningMode = useMemo(() => {
    if (planSelection === CLIENT_PLAN_TRIAL_VALUE) return "trial";
    if (planSelection === CLIENT_PLAN_CUSTOM_VALUE) return "custom";
    return "catalog";
  }, [planSelection]);

  const selectedCatalogPlan = useMemo(
    () => (provisioningMode === "catalog" ? plans.find((plan) => plan.id === planSelection) : null),
    [plans, planSelection, provisioningMode],
  );

  const soloPlan = useMemo(() => findSoloPlan(plans), [plans]);

  useEffect(() => {
    if (!open) return;
    const initialSelection = guessClientPlanSelection(
      client,
      plans,
      CLIENT_PLAN_TRIAL_VALUE,
      CLIENT_PLAN_CUSTOM_VALUE,
    );
    setPlanSelection(initialSelection);
    setTrialDays(String(DEFAULT_TRIAL_DAYS));
    setDeviceLimit(String(client.device_limit));
    const storageMb = client.storage_limit_bytes / (1024 * 1024);
    if (storageMb >= 1024 && storageMb % 1024 === 0) {
      setStorageUnit("GB");
      setStorageValue(String(storageMb / 1024));
    } else {
      setStorageUnit("MB");
      setStorageValue(String(Math.round(storageMb)));
    }
  }, [open, client, plans]);

  useEffect(() => {
    if (!open) return;
    if (provisioningMode === "catalog" && selectedCatalogPlan) {
      setDeviceLimit(String(selectedCatalogPlan.device_limit));
      const storageMb = selectedCatalogPlan.storage_limit_bytes / (1024 * 1024);
      if (storageMb >= 1024 && storageMb % 1024 === 0) {
        setStorageUnit("GB");
        setStorageValue(String(storageMb / 1024));
      } else {
        setStorageUnit("MB");
        setStorageValue(String(Math.round(storageMb)));
      }
      return;
    }

    if (provisioningMode === "trial" && soloPlan) {
      setDeviceLimit(String(soloPlan.device_limit));
      setStorageValue(String(Math.round(soloPlan.storage_limit_bytes / (1024 * 1024))));
      setStorageUnit("MB");
    }
  }, [open, provisioningMode, selectedCatalogPlan, soloPlan]);

  const limitsPreview = useMemo(() => {
    if (provisioningMode === "catalog" && selectedCatalogPlan) {
      return planLimitsLabel(selectedCatalogPlan.device_limit, selectedCatalogPlan.storage_limit_bytes);
    }
    if (provisioningMode === "trial" && soloPlan) {
      return `${trialDays}-day trial · ${planLimitsLabel(soloPlan.device_limit, soloPlan.storage_limit_bytes)}`;
    }
    if (provisioningMode === "custom") {
      const storageLimitBytes = parseStorageInput(storageValue, storageUnit);
      if (storageLimitBytes) {
        const parsedLimit = Number.parseInt(deviceLimit, 10);
        if (Number.isFinite(parsedLimit) && parsedLimit >= 1) {
          return planLimitsLabel(parsedLimit, storageLimitBytes);
        }
      }
    }
    return null;
  }, [provisioningMode, selectedCatalogPlan, soloPlan, trialDays, deviceLimit, storageValue, storageUnit]);

  if (!canWrite) {
    return null;
  }

  const displayName = client.client_name?.trim() || client.email;
  const label = "Activate or change plan";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const provisioning =
        provisioningMode === "catalog"
          ? { mode: "catalog" as const, planTemplateId: planSelection }
          : provisioningMode === "trial"
            ? {
                mode: "trial" as const,
                trialDays: Number.parseInt(trialDays, 10),
              }
            : {
                mode: "custom" as const,
                deviceLimit: Number.parseInt(deviceLimit, 10),
                storageLimitBytes: parseStorageInput(storageValue, storageUnit) ?? undefined,
              };

      const response = await fetch("/api/admin/provision-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId: client.id, provisioning }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Could not update plan");
      }

      toast.success(result?.message ?? `Plan updated for ${displayName}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Tooltip label={label}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={label}
          className="h-8 w-8 shrink-0 border-red-300 bg-red-50 p-0 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
          onClick={() => setOpen(true)}
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
        </Button>
      </Tooltip>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => (loading ? null : setOpen(false))}
        >
          <div
            role="dialog"
            aria-labelledby="activate-client-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border/70 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 id="activate-client-title" className="text-base font-semibold text-foreground">
                    Activate {displayName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a plan and apply screen and storage limits for this account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Close activation dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4 p-5">
              <div className="space-y-2">
                <Label htmlFor={`activate-plan-${client.id}`}>Plan</Label>
                <select
                  id={`activate-plan-${client.id}`}
                  className={SELECT_CLASS}
                  value={planSelection}
                  onChange={(event) => setPlanSelection(event.target.value)}
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                  <option value={CLIENT_PLAN_TRIAL_VALUE}>Trial</option>
                  <option value={CLIENT_PLAN_CUSTOM_VALUE}>Custom limits</option>
                </select>
                {limitsPreview ? (
                  <p className="text-xs text-muted-foreground">{limitsPreview}</p>
                ) : null}
              </div>

              {provisioningMode === "trial" ? (
                <div className="space-y-2">
                  <Label htmlFor={`activate-trial-days-${client.id}`}>Trial length (days)</Label>
                  <Input
                    id={`activate-trial-days-${client.id}`}
                    type="number"
                    min={1}
                    max={365}
                    value={trialDays}
                    onChange={(event) => setTrialDays(event.target.value)}
                    required
                  />
                </div>
              ) : null}

              {provisioningMode === "custom" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`activate-device-limit-${client.id}`}>Screen limit</Label>
                    <Input
                      id={`activate-device-limit-${client.id}`}
                      type="number"
                      min={1}
                      value={deviceLimit}
                      onChange={(event) => setDeviceLimit(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`activate-storage-${client.id}`}>Storage</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`activate-storage-${client.id}`}
                        type="number"
                        min={1}
                        step="any"
                        value={storageValue}
                        onChange={(event) => setStorageValue(event.target.value)}
                        className="flex-1"
                      />
                      <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-input">
                        {(["MB", "GB"] as StorageUnit[]).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => setStorageUnit(unit)}
                            className={cn(
                              "px-2.5 text-xs font-medium transition-colors",
                              storageUnit === unit
                                ? "bg-brand-faint15 text-foreground"
                                : "bg-background text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="min-w-[9rem] gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {loading ? "Applying…" : "Apply plan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
