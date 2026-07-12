"use client";

import type { AdminUserDirectoryEntry, PlanTemplate } from "@signage/types";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { AdminClientPlanDialog } from "@/components/admin/admin-client-activate-button";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";

async function extendTrial(userId: string, days: number) {
  const response = await fetch("/api/admin/trial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ userId, action: "extend", days }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to extend trial");
  }
}

export function AdminTrialActions({
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
  const [loading, setLoading] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  if (!canWrite || !client.trial_ends_at) {
    return null;
  }

  const displayName = client.client_name?.trim() || client.email;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          className="h-8"
          onClick={() => {
            if (!window.confirm(`Extend ${client.email}'s trial by 7 days?`)) {
              return;
            }
            setLoading(true);
            void (async () => {
              try {
                await extendTrial(client.id, 7);
                toast.success(`Trial extended by 7 days for ${client.email}`);
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not extend trial");
              } finally {
                setLoading(false);
              }
            })();
          }}
        >
          <CalendarPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {loading ? "Extending…" : "Extend trial +7 days"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          className="h-8"
          onClick={() => setConvertOpen(true)}
        >
          <CreditCard className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Convert to paid
        </Button>
      </div>

      <AdminClientPlanDialog
        client={client}
        plans={plans}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title={`Activate ${displayName}`}
        description="Choose a plan and apply screen and storage limits for this account."
        submitLabel="Apply plan"
      />
    </>
  );
}
