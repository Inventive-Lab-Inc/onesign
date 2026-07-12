"use client";

import { Loader2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminClientEditDetails({
  userId,
  email,
  clientName,
}: {
  userId: string;
  email: string;
  clientName?: string | null;
}) {
  const router = useRouter();
  const { canWrite } = useAdminStaff();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(clientName?.trim() ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(clientName?.trim() ?? "");
  }, [open, clientName]);

  if (!canWrite) {
    return null;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Client name is required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/update-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, clientName: trimmed }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Could not update account");
      }

      toast.success(result?.message ?? "Account details updated");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Edit
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => (loading ? null : setOpen(false))}
        >
          <div
            role="dialog"
            aria-labelledby="edit-client-details-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border/70 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 id="edit-client-details-title" className="text-base font-semibold text-foreground">
                    Edit account details
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Update the client / business name shown across admin and the console.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Close edit dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4 p-5">
              <div className="space-y-2">
                <Label htmlFor={`edit-client-email-${userId}`}>Email</Label>
                <Input id={`edit-client-email-${userId}`} value={email} disabled readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-client-name-${userId}`}>Client name</Label>
                <Input
                  id={`edit-client-name-${userId}`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Business or client name"
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="min-w-[8rem] gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {loading ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
