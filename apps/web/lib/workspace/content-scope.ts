/** Attach billing owner + active workspace to a new content row. */
export function scopedContentRow<T extends Record<string, unknown>>(
  ownerId: string,
  workspaceId: string | null | undefined,
  row: T,
): T & { owner_id: string; workspace_id: string | null } {
  return {
    ...row,
    owner_id: ownerId,
    workspace_id: workspaceId ?? null,
  };
}
