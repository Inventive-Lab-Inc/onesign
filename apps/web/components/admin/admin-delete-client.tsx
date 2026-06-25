"use client";

import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRMATION_WORD = "delete";

export function AdminDeleteClient({
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
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  if (!canWrite) {
    return null;
  }

  const displayName = clientName?.trim() || email;
  const canConfirm = confirmText.trim().toLowerCase() === CONFIRMATION_WORD;

  async function onDelete() {
    if (!canConfirm) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/delete-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, confirm: confirmText.trim().toLowerCase() }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        storageWarning?: string | null;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Could not delete account");
      }

      if (result?.storageWarning) {
        toast.warning(`Account deleted, but stored files may remain: ${result.storageWarning}`);
      } else {
        toast.success(`${displayName} and all their content were deleted`);
      }

      setOpen(false);
      router.push("/admin");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-red-300 bg-red-100 p-4 shadow-sm dark:border-red-500/40 dark:bg-red-950/40">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Danger zone</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Delete this client account</p>
            <p className="text-sm text-muted-foreground">
              Permanently removes the account, every screen, playlist, and all stored files. This
              cannot be undone.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="shrink-0 gap-2"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete account
          </Button>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => (loading ? null : setOpen(false))}
        >
          <div
            role="dialog"
            aria-labelledby="delete-client-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border/70 bg-destructive/5 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <h3 id="delete-client-title" className="text-base font-semibold text-foreground">
                      Delete {displayName}?
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      This permanently deletes the account, all screens, playlists, and stored
                      files. This action cannot be undone.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Close delete dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void onDelete();
              }}
              className="space-y-4 p-5"
            >
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="font-semibold text-foreground">{CONFIRMATION_WORD}</span> to
                  confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={CONFIRMATION_WORD}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!canConfirm || loading}
                  className="min-w-[10rem] gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                  {loading ? "Deleting…" : "Delete account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
