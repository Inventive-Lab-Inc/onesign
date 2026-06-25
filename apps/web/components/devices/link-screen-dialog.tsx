"use client";

import type { Device } from "@signage/types";
import { X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LinkScreenDialog({
  open,
  onClose,
  deviceCount,
  deviceLimit,
  onLinked,
}: {
  open: boolean;
  onClose: () => void;
  deviceCount: number;
  deviceLimit: number | null;
  onLinked: () => void | Promise<void>;
}) {
  const titleId = useId();
  const descId = useId();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const adminRoutes = useAdminClientRoutes();
  const [pairingCode, setPairingCode] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [linking, setLinking] = useState(false);
  const [mounted, setMounted] = useState(false);

  const atDeviceLimit = deviceLimit != null && deviceCount >= deviceLimit;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPairingCode("");
    setFriendlyName("");
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function linkDevice() {
    if (atDeviceLimit) {
      toast.error(`Screen limit reached (${deviceLimit}). Contact support to add more.`);
      return;
    }
    setLinking(true);
    try {
      const code = pairingCode.trim();
      if (!/^[0-9]{6}$/.test(code)) {
        toast.error("Pairing code must be exactly 6 digits.");
        return;
      }
      const ownerId = adminRoutes?.clientId ?? null;
      const { data, error } = await supabase.rpc("link_device_by_pairing_code", {
        p_code: code,
        p_name: friendlyName.trim() || null,
        p_owner_id: ownerId,
      });
      if (error) {
        if (error.message.includes("device_limit_reached")) {
          toast.error(
            `You've reached your screen limit (${deviceLimit ?? "plan limit"}). Remove a screen or upgrade your plan.`,
          );
        } else if (error.message.includes("trial_expired")) {
          toast.error("Your trial has ended. Contact us to upgrade and link more screens.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success(`Linked device ${(data as Device).name}`);
      onClose();
      await onLinked();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to link device";
      toast.error(message);
    } finally {
      setLinking(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              Link a screen
            </h2>
            <p id={descId} className="mt-1 text-sm text-muted-foreground">
              Enter the six-digit code shown on the TV.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {atDeviceLimit ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            You have reached your screen limit. Contact support if you need to link more devices.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-pair-code">Pairing code</Label>
              <Input
                id="link-pair-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="h-10 font-mono tracking-widest"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-pair-name">Display name</Label>
              <Input
                id="link-pair-name"
                value={friendlyName}
                onChange={(event) => setFriendlyName(event.target.value)}
                placeholder="Lobby screen"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!atDeviceLimit ? (
            <Button type="button" disabled={linking} onClick={() => void linkDevice()}>
              {linking ? "Linking…" : "Continue"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
