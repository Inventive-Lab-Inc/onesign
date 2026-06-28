"use client";

import type { WorkspacePermission, WorkspaceRole } from "@signage/types";
import {
  WORKSPACE_PERMISSION_GROUPS,
  WORKSPACE_PERMISSION_LABELS,
  WORKSPACE_ROLE_OPTIONS,
} from "@signage/types";
import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RoleOption = { role: WorkspaceRole | "none"; label: string; description: string };

const ROLE_SELECT_OPTIONS: RoleOption[] = [
  { role: "none", label: "No access", description: "User cannot access this workspace" },
  ...WORKSPACE_ROLE_OPTIONS,
];

function RoleSelect({
  value,
  onChange,
}: {
  value: WorkspaceRole | "none";
  onChange: (role: WorkspaceRole | "none") => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = ROLE_SELECT_OPTIONS.find((option) => option.role === value) ?? ROLE_SELECT_OPTIONS[0]!;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const gap = 4;
    const viewportPadding = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = panelHeight > 0 && spaceBelow < panelHeight + gap && rect.top > panelHeight + gap;
    let top = openUp ? rect.top - panelHeight - gap : rect.bottom + gap;
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - panelHeight - viewportPadding));
    setMenuStyle({
      position: "fixed",
      top,
      left: rect.left,
      width: rect.width,
      zIndex: 80,
      visibility: "visible",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    requestAnimationFrame(updatePosition);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onReflow() {
      updatePosition();
    }
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{selected.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{selected.description}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              style={menuStyle}
              className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
            >
              {ROLE_SELECT_OPTIONS.map((option) => {
                const isSelected = option.role === value;
                return (
                  <button
                    key={option.role}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.role);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted",
                      isSelected && "bg-muted/60",
                    )}
                  >
                    <Check
                      className={cn("mt-0.5 h-4 w-4 shrink-0 text-brand", isSelected ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export type WorkspaceRoleEntry = {
  workspace_id: string;
  role: WorkspaceRole | "none";
  permissions: WorkspacePermission[];
};

export function buildEmptyRolesByWorkspace(
  workspaces: Array<{ id: string }>,
): Record<string, WorkspaceRoleEntry> {
  return Object.fromEntries(
    workspaces.map((workspace) => [
      workspace.id,
      { workspace_id: workspace.id, role: "none" as const, permissions: [] },
    ]),
  );
}

export function rolesFromWorkspaceEntries(
  rolesByWorkspace: Record<string, WorkspaceRoleEntry>,
  workspaces: Array<{ id: string }>,
) {
  return workspaces
    .map((workspace) => rolesByWorkspace[workspace.id])
    .filter((entry): entry is WorkspaceRoleEntry => !!entry && entry.role !== "none")
    .map((entry) => ({
      workspace_id: entry.workspace_id,
      role: entry.role,
      permissions: entry.role === "custom" ? entry.permissions : [],
    }));
}

export function rolesByWorkspaceFromUser(
  workspaces: Array<{ id: string }>,
  workspaceRoles: Array<{
    workspace_id: string;
    role: WorkspaceRole;
    permissions: WorkspacePermission[];
  }>,
): Record<string, WorkspaceRoleEntry> {
  const base = buildEmptyRolesByWorkspace(workspaces);
  for (const entry of workspaceRoles) {
    base[entry.workspace_id] = {
      workspace_id: entry.workspace_id,
      role: entry.role,
      permissions: entry.permissions ?? [],
    };
  }
  return base;
}

export function WorkspaceRolePicker({
  workspaceName,
  entry,
  onChange,
}: {
  workspaceName: string;
  entry: WorkspaceRoleEntry;
  onChange: (entry: WorkspaceRoleEntry) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-semibold text-foreground">{workspaceName}</p>
      <div className="mt-3 space-y-1.5">
        <Label>Role</Label>
        <RoleSelect
          value={entry.role}
          onChange={(role) =>
            onChange({ ...entry, role, permissions: role === "custom" ? entry.permissions : [] })
          }
        />
      </div>

      {entry.role === "custom" ? (
        <div className="mt-4 space-y-4">
          {WORKSPACE_PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
              <ul className="mt-2 space-y-2">
                {group.permissions.map((permission) => {
                  const checked = entry.permissions.includes(permission);
                  return (
                    <li key={permission}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const permissions = checked
                              ? entry.permissions.filter((value) => value !== permission)
                              : [...entry.permissions, permission];
                            onChange({ ...entry, permissions });
                          }}
                        />
                        {WORKSPACE_PERMISSION_LABELS[permission]}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
