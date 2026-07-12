"use client";

import type { AdminUserDirectoryEntry, PlanTemplate } from "@signage/types";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export type AdminClientPlanFormClient = Pick<
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

type AdminClientPlanFormProps = {
  client: AdminClientPlanFormClient;
  plans: PlanTemplate[];
  /** When false, form remounts initial selection from the client (e.g. dialog closed). */
  active?: boolean;
  submitLabel?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
};

export function AdminClientPlanForm({
  client,
  plans,
  active = true,
  submitLabel = "Apply plan",
  onSuccess,
  onCancel,
  showCancel = false,
}: AdminClientPlanFormProps) {
  const router = useRouter();
  const defaultPlanId = plans[0]?.id ?? CLIENT_PLAN_CUSTOM_VALUE;

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
    if (!active) return;
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
  }, [active, client, plans]);

  useEffect(() => {
    if (!active) return;
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
  }, [active, provisioningMode, selectedCatalogPlan, soloPlan]);

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

  const displayName = client.client_name?.trim() || client.email;

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
      onSuccess?.();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`client-plan-${client.id}`}>Plan</Label>
        <select
          id={`client-plan-${client.id}`}
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
        {limitsPreview ? <p className="text-xs text-muted-foreground">{limitsPreview}</p> : null}
      </div>

      {provisioningMode === "trial" ? (
        <div className="space-y-2">
          <Label htmlFor={`client-trial-days-${client.id}`}>Trial length (days)</Label>
          <Input
            id={`client-trial-days-${client.id}`}
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
            <Label htmlFor={`client-device-limit-${client.id}`}>Screen limit</Label>
            <Input
              id={`client-device-limit-${client.id}`}
              type="number"
              min={1}
              value={deviceLimit}
              onChange={(event) => setDeviceLimit(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`client-storage-${client.id}`}>Storage</Label>
            <div className="flex gap-2">
              <Input
                id={`client-storage-${client.id}`}
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
        {showCancel && onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={loading} className="min-w-[9rem] gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loading ? "Applying…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
