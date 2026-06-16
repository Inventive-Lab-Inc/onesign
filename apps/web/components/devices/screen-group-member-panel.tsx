"use client";

import { ArrowRight, MonitorUp, UserMinus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { groupDetailPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { buttonVariants, Button } from "@/components/ui/button";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { removeDeviceFromGroup } from "@/lib/group-playlist";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ScreenGroupMemberPanel({
  groupId,
  groupName,
  groupPlaylistId,
  device,
  ownerId,
  canRemove = false,
}: {
  groupId: string;
  groupName: string;
  groupPlaylistId: string | null;
  device: DeviceWithAssignments;
  ownerId: string;
  canRemove?: boolean;
}) {
  const adminRoutes = useAdminClientRoutes();
  const { syncNow } = useConsoleSync();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const groupHref = groupDetailPath(groupId, adminRoutes);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try {
      const { error } = await removeDeviceFromGroup(
        supabase,
        ownerId,
        { id: groupId, name: groupName, playlist_id: groupPlaylistId },
        device,
      );
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(`“${device.name}” removed from “${groupName}”`);
      setConfirmOpen(false);
      await syncNow();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove screen from group";
      toast.error(message);
    } finally {
      setRemoving(false);
    }
  }, [device, groupId, groupName, groupPlaylistId, ownerId, supabase, syncNow]);

  return (
    <>
      <aside className="w-full min-w-0 shrink-0 lg:w-full">
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-border bg-white px-6 py-12 text-center shadow-sm dark:bg-card lg:min-h-[420px]">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <MonitorUp className="h-9 w-9 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Screen group member</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            This screen is a member of <span className="font-medium text-foreground">{groupName}</span>. The playlist
            is managed at the screen group level.
          </p>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
            <Link
              href={groupHref}
              className={cn(buttonVariants({ size: "lg" }), "w-full gap-2 px-5 font-semibold shadow-sm")}
            >
              Open screen group
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {canRemove ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full gap-2 font-semibold"
                onClick={() => setConfirmOpen(true)}
              >
                <UserMinus className="h-4 w-4" aria-hidden />
                Remove from group
              </Button>
            ) : null}
          </div>
        </div>
      </aside>

      <ConfirmActionDialog
        open={confirmOpen}
        title="Remove from screen group?"
        description={
          <>
            <span className="font-medium text-foreground">{device.name}</span> will leave{" "}
            <span className="font-medium text-foreground">{groupName}</span> and switch back to its own playlist. You
            can edit the playlist on this page again.
          </>
        }
        confirmLabel="Remove from group"
        confirmingLabel="Removing…"
        confirmVariant="destructive"
        isConfirming={removing}
        onClose={() => !removing && setConfirmOpen(false)}
        onConfirm={handleRemove}
      />
    </>
  );
}
