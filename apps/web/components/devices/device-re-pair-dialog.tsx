"use client";

import { X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useConsoleOwnerId } from "@/components/console/console-sync-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { friendlyWorkspaceError } from "@/lib/workspace/error-messages";

export function DeviceRePairDialog({
  open,
  onClose,
  deviceId,
  deviceName,
  onRepaired,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  onRepaired: () => void | Promise<void>;
}) {
  const titleId = useId();
  const descId = useId();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const adminRoutes = useAdminClientRoutes();
  const accountOwnerId = useConsoleOwnerId();
  const [pairingCode, setPairingCode] = useState("");
  const [rebinding, setRebinding] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPairingCode("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function rebindDevice() {
    const code = pairingCode.trim();
    if (!/^[0-9]{6}$/.test(code)) {
      toast.error("Pairing code must be exactly 6 digits.");
      return;
    }

    setRebinding(true);
    try {
      const ownerId = adminRoutes?.clientId ?? accountOwnerId ?? null;
      const { error } = await supabase.rpc("rebind_device_by_pairing_code", {
        p_device_id: deviceId,
        p_code: code,
        p_owner_id: ownerId,
      });
      if (error) {
        if (error.message.includes("trial_expired")) {
          toast.error("Your trial has ended. Contact us to upgrade and manage screens.");
        } else {
          toast.error(
            friendlyWorkspaceError(error.message, "Unable to reconnect this player. Please try again."),
          );
        }
        return;
      }
      toast.success("Player reconnected. It should resume playback shortly.");
      onClose();
      await onRepaired();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reconnect player";
      toast.error(message);
    } finally {
      setRebinding(false);
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
              Reconnect player
            </h2>
            <p id={descId} className="mt-1 text-sm text-muted-foreground">
              Enter the six-digit code shown on the player to reconnect it to{" "}
              <span className="font-medium text-foreground">{deviceName}</span>. Playlists and
              settings on this screen are kept.
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

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="re-pair-code">Pairing code</Label>
          <Input
            id="re-pair-code"
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

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={rebinding || pairingCode.length !== 6}
            onClick={() => void rebindDevice()}
          >
            {rebinding ? "Reconnecting…" : "Reconnect"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
