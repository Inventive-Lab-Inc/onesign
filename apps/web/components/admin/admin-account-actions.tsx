"use client";

import { Loader2, Power } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function setAccountDisabled(userId: string, disabled: boolean) {
  const response = await fetch("/api/admin/account-disabled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ userId, disabled }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to update account");
  }
}

export function AdminAccountActions({
  userId,
  email,
  isDisabled,
}: {
  userId: string;
  email: string;
  isDisabled: boolean;
}) {
  const router = useRouter();
  const { canWrite } = useAdminStaff();
  const [loading, setLoading] = useState(false);
  const nextDisabled = !isDisabled;
  const label = isDisabled ? "Enable account" : "Disable account";

  if (!canWrite) {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={isDisabled ? "default" : "destructive"}
      disabled={loading}
      title={label}
      aria-label={label}
      className={cn(
        "h-8 w-8 shrink-0 p-0",
        isDisabled && "bg-emerald-600 text-white hover:bg-emerald-700",
      )}
      onClick={() => {
        const message = nextDisabled
          ? `Disable ${email}? All of their screens will pause immediately.`
          : `Re-enable ${email}? All of their screens will resume playback.`;
        if (!window.confirm(message)) return;

        setLoading(true);
        void (async () => {
          try {
            await setAccountDisabled(userId, nextDisabled);
            toast.success(nextDisabled ? "Account disabled" : "Account enabled");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not update account");
          } finally {
            setLoading(false);
          }
        })();
      }}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Power className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
