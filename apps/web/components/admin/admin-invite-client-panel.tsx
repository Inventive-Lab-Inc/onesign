"use client";

import { MailPlus } from "lucide-react";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AdminInviteClientPanel() {
  const router = useRouter();
  const { canWrite } = useAdminStaff();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [deviceLimit, setDeviceLimit] = useState("1");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter an email address");
      return;
    }

    const parsedLimit = Number.parseInt(deviceLimit, 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      toast.error("Screen limit must be at least 1");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/invite-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: trimmedEmail,
          clientName: clientName.trim() || undefined,
          deviceLimit: parsedLimit,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not send invitation");
      }

      toast.success(body?.message ?? `Invitation sent to ${trimmedEmail}`);
      setOpen(false);
      setEmail("");
      setClientName("");
      setDeviceLimit("1");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setLoading(false);
    }
  }

  if (!canWrite) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="sm"
        className="gap-2"
        onClick={() => setOpen((value) => !value)}
      >
        <MailPlus className="h-4 w-4" aria-hidden />
        {open ? "Close invite form" : "Invite client"}
      </Button>

      <form
        onSubmit={onSubmit}
        className={cn(
          "grid gap-4 rounded-xl border border-border/90 bg-card p-4 shadow-sm transition-all sm:grid-cols-2 lg:grid-cols-4",
          open ? "block" : "hidden",
        )}
      >
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="client@company.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-client-name">Client name</Label>
          <Input
            id="invite-client-name"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Acme Retail"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-device-limit">Screen limit</Label>
          <Input
            id="invite-device-limit"
            type="number"
            min={1}
            value={deviceLimit}
            onChange={(event) => setDeviceLimit(event.target.value)}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Sending…" : "Send invitation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
