"use client";

import { ChevronRight, FolderOpen, ListVideo, Plus, Settings2, Tv } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveGroupColor } from "@/lib/device-group-colors";
import type { DeviceGroupWithMembers } from "@/lib/console-sync";

type DeviceGroupFolderCardProps = {
  name: string;
  accentColor?: string | null;
  itemCount: number;
  itemLabel?: string;
  secondaryHint?: string | null;
  previewIcon?: LucideIcon;
  variant?: "group" | "ungrouped";
  onOpen: () => void;
  onEdit?: () => void;
  className?: string;
  compact?: boolean;
};

export function DeviceGroupFolderCard({
  name,
  accentColor,
  itemCount,
  itemLabel = "screen",
  secondaryHint = null,
  previewIcon: PreviewIcon = Tv,
  variant = "group",
  onOpen,
  onEdit,
  className,
  compact = false,
}: DeviceGroupFolderCardProps) {
  const color = variant === "ungrouped" ? "hsl(var(--muted-foreground))" : resolveGroupColor(accentColor);
  const itemLabelPlural = itemCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <li className={cn("device-group-folder-card group/folder", compact && "device-group-folder-card--compact", className)}>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "device-group-folder-card__hit relative flex h-full w-full flex-col items-stretch text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          compact ? "min-h-[8.5rem]" : "min-h-[11.5rem]",
        )}
        aria-label={`Open folder ${name}, ${itemCount} ${itemLabelPlural}`}
        style={{ "--folder-accent": color } as React.CSSProperties}
      >
        <div className="device-group-folder-card__shell relative mx-auto mt-1 w-[88%] flex-1">
          <div className="device-group-folder-card__tab" aria-hidden />
          <div className="device-group-folder-card__body">
            <div className="device-group-folder-card__glow" aria-hidden />
            <div className="device-group-folder-card__preview" aria-hidden>
              {itemCount > 0 ? (
                <>
                  <span className="device-group-folder-card__screen device-group-folder-card__screen--back">
                    <PreviewIcon strokeWidth={1.5} />
                  </span>
                  <span className="device-group-folder-card__screen device-group-folder-card__screen--mid">
                    <PreviewIcon strokeWidth={1.5} />
                  </span>
                  <span className="device-group-folder-card__screen device-group-folder-card__screen--front">
                    <PreviewIcon strokeWidth={1.5} />
                  </span>
                </>
              ) : (
                <span className="device-group-folder-card__empty">
                  <FolderOpen strokeWidth={1.5} />
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-[1] px-1 pb-1 pt-2">
          <p
            className={cn(
              "line-clamp-2 font-semibold leading-snug text-foreground",
              compact ? "text-xs" : "text-sm",
            )}
            title={name}
          >
            {name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {itemCount} {itemLabelPlural}
            {secondaryHint ? (
              <>
                {" "}
                · <span className="text-brand-badge dark:text-brand-onDarkSoft">{secondaryHint}</span>
              </>
            ) : null}
          </p>
        </div>
      </button>

      {onEdit ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="device-group-folder-card__edit absolute right-2 top-2 z-[2] rounded-md bg-background/90 p-1.5 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border/80 backdrop-blur-sm transition-all hover:bg-muted hover:text-foreground group-hover/folder:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Edit group ${name}`}
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      ) : null}
    </li>
  );
}

export function GroupFolderCreateCard({
  onClick,
  label = "New folder",
  hint = "Create a group",
  compact = false,
}: {
  onClick: () => void;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <li className={cn("device-group-folder-card device-group-folder-card--create group/folder", compact && "device-group-folder-card--compact")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "device-group-folder-card__hit device-group-folder-card__hit--create relative flex h-full w-full flex-col items-stretch text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          compact ? "min-h-[8.5rem]" : "min-h-[11.5rem]",
        )}
        aria-label={label}
      >
        <div className="device-group-folder-card__shell device-group-folder-card__shell--create relative mx-auto mt-1 w-[88%] flex-1">
          <div className="device-group-folder-card__tab device-group-folder-card__tab--create" aria-hidden />
          <div className="device-group-folder-card__body device-group-folder-card__body--create">
            <div className="device-group-folder-card__preview" aria-hidden>
              <span className="device-group-folder-card__create-icon">
                <Plus strokeWidth={2} />
              </span>
            </div>
          </div>
        </div>
        <div className="relative z-[1] px-1 pb-1 pt-3 text-center">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </button>
    </li>
  );
}

export function DeviceGroupFolderCardFromGroup({
  group,
  itemCount,
  onlineCount,
  onOpen,
  onEdit,
}: {
  group: DeviceGroupWithMembers;
  itemCount: number;
  onlineCount: number;
  onOpen: () => void;
  onEdit?: () => void;
}) {
  return (
    <DeviceGroupFolderCard
      name={group.name}
      accentColor={group.accent_color}
      itemCount={itemCount}
      secondaryHint={onlineCount > 0 ? `${onlineCount} online` : null}
      onOpen={onOpen}
      onEdit={onEdit}
    />
  );
}

type DeviceGroupFolderListRowProps = {
  name: string;
  accentColor?: string | null;
  itemCount: number;
  itemLabel?: string;
  secondaryHint?: string | null;
  previewIcon?: LucideIcon;
  onOpen: () => void;
  onEdit?: () => void;
};

export function DeviceGroupFolderListRow({
  name,
  accentColor,
  itemCount,
  itemLabel = "screen",
  secondaryHint = null,
  previewIcon: PreviewIcon = Tv,
  onOpen,
  onEdit,
}: DeviceGroupFolderListRowProps) {
  const color = resolveGroupColor(accentColor);
  const itemLabelPlural = itemCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <li className="device-group-folder-list-row group/folder-row" style={{ "--folder-accent": color } as React.CSSProperties}>
      <button
        type="button"
        onClick={onOpen}
        className="device-group-folder-list-row__hit flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open folder ${name}, ${itemCount} ${itemLabelPlural}`}
      >
        <span className="device-group-folder-list-row__icon" aria-hidden>
          <PreviewIcon strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {itemCount} {itemLabelPlural}
            {secondaryHint ? (
              <>
                {" "}
                · <span className="text-brand-badge dark:text-brand-onDarkSoft">{secondaryHint}</span>
              </>
            ) : null}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
      </button>
      {onEdit ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="device-group-folder-list-row__edit rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/folder-row:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Edit group ${name}`}
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      ) : null}
    </li>
  );
}

export function DeviceGroupFolderListRowFromGroup({
  group,
  itemCount,
  onlineCount,
  onOpen,
  onEdit,
}: {
  group: DeviceGroupWithMembers;
  itemCount: number;
  onlineCount: number;
  onOpen: () => void;
  onEdit?: () => void;
}) {
  return (
    <DeviceGroupFolderListRow
      name={group.name}
      accentColor={group.accent_color}
      itemCount={itemCount}
      secondaryHint={onlineCount > 0 ? `${onlineCount} online` : null}
      onOpen={onOpen}
      onEdit={onEdit}
    />
  );
}

export function GroupFolderCreateListRow({
  onClick,
  label = "New folder",
  hint = "Create a group",
}: {
  onClick: () => void;
  label?: string;
  hint?: string;
}) {
  return (
    <li className="device-group-folder-list-row device-group-folder-list-row--create">
      <button
        type="button"
        onClick={onClick}
        className="device-group-folder-list-row__hit flex w-full items-center gap-3 px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={label}
      >
        <span className="device-group-folder-list-row__icon device-group-folder-list-row__icon--create" aria-hidden>
          <Plus strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
        </span>
      </button>
    </li>
  );
}
