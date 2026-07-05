"use client";

import type { PlanTemplate } from "@signage/types";
import { Eye, EyeOff, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountToggle } from "@/components/account/account-toggle";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLIENT_PLAN_CUSTOM_VALUE,
  CLIENT_PLAN_TRIAL_VALUE,
  findSoloPlan,
  type ClientProvisioningMode,
} from "@/lib/admin/client-provisioning";
import {
  DEFAULT_STORAGE_LIMIT_BYTES,
  DEFAULT_TRIAL_DAYS,
  formatStorageBytes,
  parseStorageInput,
  type StorageUnit,
} from "@/lib/plan-quota";
import { cn } from "@/lib/utils";

const MIN_PASSWORD_LENGTH = 8;
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

function planLimitsLabel(deviceLimit: number, storageLimitBytes: number): string {
  return `${deviceLimit} screen${deviceLimit === 1 ? "" : "s"} · ${formatStorageBytes(storageLimitBytes)} storage`;
}

type AdminAddClientPanelProps = {
  plans: PlanTemplate[];
};

export function AdminAddClientPanel({ plans }: AdminAddClientPanelProps) {
  const router = useRouter();
  const { canWrite } = useAdminStaff();
  const defaultPlanId = plans[0]?.id ?? CLIENT_PLAN_CUSTOM_VALUE;

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [sendSetupEmail, setSendSetupEmail] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [planSelection, setPlanSelection] = useState(defaultPlanId);
  const [trialDays, setTrialDays] = useState(String(DEFAULT_TRIAL_DAYS));
  const [deviceLimit, setDeviceLimit] = useState("1");
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
    setEmail("");
    setClientName("");
    setSendSetupEmail(true);
    setPassword("");
    setShowPassword(false);
    setPlanSelection(defaultPlanId);
    setTrialDays(String(DEFAULT_TRIAL_DAYS));
    setDeviceLimit(String(plans[0]?.device_limit ?? 1));
    setStorageValue(
      plans[0]
        ? String(Math.round(plans[0].storage_limit_bytes / (1024 * 1024)))
        : "500",
    );
    setStorageUnit("MB");
  }, [open, defaultPlanId, plans]);

  useEffect(() => {
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
  }, [provisioningMode, selectedCatalogPlan, soloPlan]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter an email address");
      return;
    }

    if (!sendSetupEmail && password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    const parsedTrialDays = Number.parseInt(trialDays, 10);
    const parsedLimit = Number.parseInt(deviceLimit, 10);
    const storageLimitBytes =
      parseStorageInput(storageValue, storageUnit) ?? DEFAULT_STORAGE_LIMIT_BYTES;

    if (provisioningMode === "trial") {
      if (!Number.isFinite(parsedTrialDays) || parsedTrialDays < 1 || parsedTrialDays > 365) {
        toast.error("Trial length must be between 1 and 365 days");
        return;
      }
    }

    if (provisioningMode === "custom") {
      if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
        toast.error("Screen limit must be at least 1");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: trimmedEmail,
          clientName: clientName.trim() || undefined,
          sendSetupEmail,
          password: sendSetupEmail ? undefined : password,
          provisioning:
            provisioningMode === "catalog"
              ? {
                  mode: "catalog",
                  planTemplateId: planSelection,
                }
              : provisioningMode === "trial"
                ? {
                    mode: "trial",
                    trialDays: parsedTrialDays,
                  }
                : {
                    mode: "custom",
                    deviceLimit: parsedLimit,
                    storageLimitBytes,
                  },
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not create account");
      }

      toast.success(body?.message ?? `Account created for ${trimmedEmail}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  if (!canWrite) {
    return null;
  }

  const limitsPreview =
    provisioningMode === "catalog" && selectedCatalogPlan
      ? planLimitsLabel(selectedCatalogPlan.device_limit, selectedCatalogPlan.storage_limit_bytes)
      : provisioningMode === "trial" && soloPlan
        ? planLimitsLabel(soloPlan.device_limit, soloPlan.storage_limit_bytes)
        : null;

  const helperText =
    provisioningMode === "trial"
      ? "Creates a trial account. The client can use the product until the trial ends, then needs an upgrade."
      : provisioningMode === "custom"
        ? "Creates an active account with bespoke limits you set below."
        : "Creates an active account on the selected catalog plan.";

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="gap-2 shadow-sm"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        Add client
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="add-client-title"
            aria-modal="true"
            className={cn(
              "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/80 bg-card shadow-2xl",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border/70 bg-gradient-to-br from-brand-soft/40 via-card to-card px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 id="add-client-title" className="text-base font-semibold text-foreground">
                    Add a new client
                  </h3>
                  <p className="text-sm text-muted-foreground">{helperText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close add client dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4 p-5">
              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="client@company.com"
                  required
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-client-name">Client / business name</Label>
                <Input
                  id="add-client-name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Acme Retail"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-plan">Plan</Label>
                <select
                  id="add-plan"
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
                  <Label htmlFor="add-trial-days">Trial length (days)</Label>
                  <Input
                    id="add-trial-days"
                    type="number"
                    min={1}
                    max={365}
                    value={trialDays}
                    onChange={(event) => setTrialDays(event.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Trial uses {soloPlan?.name ?? "Solo"} limits. The account expires when the trial ends.
                  </p>
                </div>
              ) : null}

              {provisioningMode === "custom" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="add-device-limit">Screen limit</Label>
                    <Input
                      id="add-device-limit"
                      type="number"
                      min={1}
                      value={deviceLimit}
                      onChange={(event) => setDeviceLimit(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-storage">Storage</Label>
                    <div className="flex gap-2">
                      <Input
                        id="add-storage"
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

              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Email a set-password link
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {sendSetupEmail
                        ? "The client receives the same secure email as a password reset and chooses their own password."
                        : "Set a password yourself and share it with the client directly."}
                    </p>
                  </div>
                  <AccountToggle
                    checked={sendSetupEmail}
                    onCheckedChange={setSendSetupEmail}
                    label="Email a set-password link"
                  />
                </div>
              </div>

              {sendSetupEmail ? null : (
                <div className="space-y-2">
                  <Label htmlFor="add-password">Password</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="add-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPassword(generatePassword());
                        setShowPassword(true);
                      }}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="min-w-[9rem]">
                  {loading
                    ? "Creating…"
                    : sendSetupEmail
                      ? "Create & send email"
                      : "Create account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
