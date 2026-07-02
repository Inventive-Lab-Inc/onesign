"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useWorkspaceOptional } from "@/components/workspace/workspace-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { friendlyWorkspaceError } from "@/lib/workspace/error-messages";

export function MoveToWorkspaceDialog({
  open,
  onClose,
  entityType,
  entityId,
  entityLabel,
}: {
  open: boolean;
  onClose: () => void;
  entityType: "device" | "media" | "playlist" | "website";
  entityId: string;
  entityLabel: string;
}) {
  const workspace = useWorkspaceOptional();
  const { syncNow } = useConsoleSync();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState("");
  const [moving, setMoving] = useState(false);

  if (!workspace || !open) return null;

  const { workspaces, activeWorkspaceId, isAccountOwner } = workspace;
  const destinationOptions = workspaces.filter((entry) => entry.id !== activeWorkspaceId);

  async function move() {
    if (!targetWorkspaceId) {
      toast.error("Choose a destination workspace.");
      return;
    }
    setMoving(true);
    try {
      const { error } = await supabase.rpc("move_to_workspace", {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_workspace_id: targetWorkspaceId,
      });
      if (error) {
        toast.error(friendlyWorkspaceError(error.message));
        return;
      }
      toast.success(`Moved ${entityLabel}`);
      await syncNow();
      onClose();
    } finally {
      setMoving(false);
    }
  }

  if (!isAccountOwner && destinationOptions.length === 0) {
    return null;
  }

  if (destinationOptions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
          <h2 className="text-lg font-bold text-foreground">Move to a different workspace</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create another workspace first to move items between them.
          </p>
          <div className="mt-6 flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-bold text-foreground">Move to a different workspace</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Move <span className="font-medium text-foreground">{entityLabel}</span> to another workspace in your account.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="destination-workspace">Destination workspace</Label>
          <select
            id="destination-workspace"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={targetWorkspaceId}
            onChange={(event) => setTargetWorkspaceId(event.target.value)}
          >
            <option value="">Select workspace</option>
            {destinationOptions.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={moving} onClick={() => void move()}>
            {moving ? "Moving…" : "Move"}
          </Button>
        </div>
      </div>
    </div>
  );
}
