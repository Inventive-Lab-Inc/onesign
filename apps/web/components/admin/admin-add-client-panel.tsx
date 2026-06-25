"use client";

import { Eye, EyeOff, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountToggle } from "@/components/account/account-toggle";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_STORAGE_LIMIT_BYTES, parseStorageInput, type StorageUnit } from "@/lib/plan-quota";
import { cn } from "@/lib/utils";

const MIN_PASSWORD_LENGTH = 8;

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

export function AdminAddClientPanel() {
  const router = useRouter();
  const { canWrite } = useAdminStaff();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [sendSetupEmail, setSendSetupEmail] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deviceLimit, setDeviceLimit] = useState("1");
  const [storageValue, setStorageValue] = useState("500");
  const [storageUnit, setStorageUnit] = useState<StorageUnit>("MB");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setClientName("");
    setSendSetupEmail(true);
    setPassword("");
    setShowPassword(false);
    setDeviceLimit("1");
    setStorageValue("500");
    setStorageUnit("MB");
  }, [open]);

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

    const parsedLimit = Number.parseInt(deviceLimit, 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      toast.error("Screen limit must be at least 1");
      return;
    }

    const storageLimitBytes =
      parseStorageInput(storageValue, storageUnit) ?? DEFAULT_STORAGE_LIMIT_BYTES;

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
          deviceLimit: parsedLimit,
          storageLimitBytes,
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
              "w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border/70 bg-gradient-to-br from-brand-soft/40 via-card to-card px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 id="add-client-title" className="text-base font-semibold text-foreground">
                    Add a new client
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Creates an active account right away. By default we email the client a secure
                    link to set their own password.
                  </p>
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
