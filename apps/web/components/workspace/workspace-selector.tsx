"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { shellChrome } from "@/components/shell/shell-chrome";

export function WorkspaceSelector() {
  const { workspaces, activeWorkspace, activeWorkspaceId, setActiveWorkspaceId, ready } = useWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!ready || workspaces.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          height: "2rem",
          padding: "0 0.625rem",
          borderRadius: "0.4375rem",
          border: shellChrome.border,
          background: shellChrome.background,
          fontSize: "0.75rem",
          fontWeight: 600,
          color: shellChrome.text,
          cursor: "pointer",
          maxWidth: "12rem",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activeWorkspace?.name ?? "Workspace"}
        </span>
        <ChevronDown size={12} color={shellChrome.textMuted} strokeWidth={2} />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="Select workspace"
          style={{
            position: "absolute",
            top: "calc(100% + 0.25rem)",
            right: 0,
            minWidth: "12rem",
            margin: 0,
            padding: "0.25rem 0",
            listStyle: "none",
            background: "#fff",
            border: "0.0625rem solid #E8ECF0",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 1000,
          }}
        >
          {workspaces.map((workspace) => {
            const selected = workspace.id === activeWorkspaceId;
            return (
              <li key={workspace.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveWorkspaceId(workspace.id);
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    border: "none",
                    background: selected ? "#F3F4F6" : "transparent",
                    textAlign: "left",
                    fontSize: "0.8125rem",
                    fontWeight: selected ? 600 : 500,
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  {workspace.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
