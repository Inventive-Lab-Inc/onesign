"use client";

import { ChevronRight, Plus, Settings2, Tv } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ItemActionMenu, type ActionMenuItem } from "@/components/console/item-action-menu";
import { cn } from "@/lib/utils";
import { resolveGroupColor } from "@/lib/device-group-colors";
import type { DeviceGroupWithMembers } from "@/lib/console-sync";

function WallDisplayGrid({ count, onlineCount }: { count: number; onlineCount?: number }) {
  if (count === 0) {
    return (
      <div className="device-group-wall-card__grid device-group-wall-card__grid--empty" aria-hidden>
        <span className="device-group-wall-card__display device-group-wall-card__display--empty">
          <Tv strokeWidth={1.5} />
        </span>
      </div>
    );
  }

  const visibleSlots = Math.min(count, 4);
  const overflow = count > 4 ? count - 4 : 0;
  const liveSlots = onlineCount != null ? Math.min(onlineCount, visibleSlots) : 0;

  return (
    <div
      className={cn(
        "device-group-wall-card__grid",
        visibleSlots === 1 && "device-group-wall-card__grid--1",
        visibleSlots === 2 && "device-group-wall-card__grid--2",
        visibleSlots >= 3 && "device-group-wall-card__grid--4",
      )}
      aria-hidden
    >
      {Array.from({ length: visibleSlots }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "device-group-wall-card__display",
            index < liveSlots && "device-group-wall-card__display--live",
          )}
        >
          <Tv strokeWidth={1.5} />
        </span>
      ))}
      {overflow > 0 ? <span className="device-group-wall-card__overflow">+{overflow}</span> : null}
    </div>
  );
}

type DeviceGroupWallCardProps = {
  name: string;
  accentColor?: string | null;
  itemCount: number;
  onlineCount?: number;
  itemLabel?: string;
  secondaryHint?: string | null;
  previewIcon?: LucideIcon;
  variant?: "group" | "ungrouped";
  onOpen: () => void;
  onEdit?: () => void;
  className?: string;
  compact?: boolean;
};

export function DeviceGroupWallCard({
  name,
  accentColor,
  itemCount,
  onlineCount = 0,
  itemLabel = "screen",
  secondaryHint = null,
  variant = "group",
  onOpen,
  onEdit,
  className,
  compact = false,
}: DeviceGroupWallCardProps) {
  const color = variant === "ungrouped" ? "hsl(var(--muted-foreground))" : resolveGroupColor(accentColor);
  const itemLabelPlural = itemCount === 1 ? itemLabel : `${itemLabel}s`;

  const menuItems: ActionMenuItem[] = onEdit
    ? [
        {
          label: "Edit group",
          icon: <Settings2 className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: onEdit,
        },
      ]
    : [];

  return (
    <li className={cn("device-group-wall-card", compact && "device-group-wall-card--compact", className)}>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "device-group-wall-card__hit",
          compact ? "min-h-[7rem]" : "min-h-[10rem]",
        )}
        aria-label={`Open group ${name}, ${itemCount} ${itemLabelPlural}`}
        style={{ "--wall-accent": color } as React.CSSProperties}
      >
        <div className="device-group-wall-card__panel">
          <div className="device-group-wall-card__accent-bar">
            {onlineCount > 0 ? (
              <span className="device-group-wall-card__live-pill">
                <span className="device-group-wall-card__live-dot" aria-hidden />
                {onlineCount} live
              </span>
            ) : itemCount > 0 ? (
              <span className="device-group-wall-card__idle-pill">All offline</span>
            ) : null}
          </div>
          <div className="device-group-wall-card__stage">
            <WallDisplayGrid count={itemCount} onlineCount={onlineCount} />
          </div>
          <div className="device-group-wall-card__bezel" aria-hidden />
        </div>
      </button>

      <div className="device-group-wall-card__meta">
        <div className="device-group-wall-card__title-row">
          <button type="button" onClick={onOpen} className="device-group-wall-card__name-btn">
            <p
              className={cn(
                "device-group-wall-card__name font-semibold leading-snug text-foreground",
                compact ? "text-sm" : "text-base",
              )}
              title={name}
            >
              {name}
            </p>
          </button>
          {menuItems.length > 0 ? (
            <ItemActionMenu
              ariaLabel={`Actions for ${name}`}
              items={menuItems}
              className={cn("device-group-wall-card__menu shrink-0", compact && "device-group-wall-card__menu--compact")}
            />
          ) : null}
        </div>
        <p className="device-group-wall-card__count" title={`${itemCount} ${itemLabelPlural}`}>
          {itemCount} {itemLabelPlural}
          {secondaryHint ? (
            <>
              {" "}
              · <span className="text-brand-badge dark:text-brand-onDarkSoft">{secondaryHint}</span>
            </>
          ) : null}
        </p>
      </div>
    </li>
  );
}

export function GroupWallCreateCard({
  onClick,
  label = "New group",
  hint = "Organize screens",
  compact = false,
}: {
  onClick: () => void;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <li className={cn("device-group-wall-card device-group-wall-card--create", compact && "device-group-wall-card--compact")}>
      <button
        type="button"
        onClick={onClick}
        className={cn("device-group-wall-card__hit device-group-wall-card__hit--create", compact ? "min-h-[8.5rem]" : "min-h-[11.5rem]")}
        aria-label={label}
      >
        <div className="device-group-wall-card__panel device-group-wall-card__panel--create">
          <div className="device-group-wall-card__stage">
            <span className="device-group-wall-card__create-ring">
              <Plus strokeWidth={2} aria-hidden />
            </span>
          </div>
        </div>
        <div className="device-group-wall-card__create-copy">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </button>
    </li>
  );
}

export function DeviceGroupWallCardFromGroup({
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
    <DeviceGroupWallCard
      name={group.name}
      accentColor={group.accent_color}
      itemCount={itemCount}
      onlineCount={onlineCount}
      onOpen={onOpen}
      onEdit={onEdit}
    />
  );
}

export function DeviceGroupWallListRow({
  name,
  accentColor,
  itemCount,
  onlineCount = 0,
  itemLabel = "screen",
  secondaryHint = null,
  onOpen,
  onEdit,
}: {
  name: string;
  accentColor?: string | null;
  itemCount: number;
  onlineCount?: number;
  itemLabel?: string;
  secondaryHint?: string | null;
  onOpen: () => void;
  onEdit?: () => void;
}) {
  const color = resolveGroupColor(accentColor);
  const itemLabelPlural = itemCount === 1 ? itemLabel : `${itemLabel}s`;

  const menuItems: ActionMenuItem[] = onEdit
    ? [
        {
          label: "Edit group",
          icon: <Settings2 className="h-4 w-4 shrink-0" aria-hidden />,
          onClick: onEdit,
        },
      ]
    : [];

  return (
    <li className="device-group-wall-list-row" style={{ "--wall-accent": color } as React.CSSProperties}>
      <button
        type="button"
        onClick={onOpen}
        className="device-group-wall-list-row__hit"
        aria-label={`Open group ${name}, ${itemCount} ${itemLabelPlural}`}
      >
        <span className="device-group-wall-list-row__wall" aria-hidden>
          <span className={cn("device-group-wall-list-row__tile", onlineCount > 0 && "device-group-wall-list-row__tile--live")}>
            <Tv strokeWidth={1.75} />
          </span>
          {itemCount > 1 ? (
            <span className="device-group-wall-list-row__tile device-group-wall-list-row__tile--ghost">
              <Tv strokeWidth={1.75} />
            </span>
          ) : null}
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
      {menuItems.length > 0 ? (
        <ItemActionMenu ariaLabel={`Actions for ${name}`} items={menuItems} className="device-group-wall-list-row__menu shrink-0" />
      ) : null}
    </li>
  );
}

export function DeviceGroupWallListRowFromGroup({
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
    <DeviceGroupWallListRow
      name={group.name}
      accentColor={group.accent_color}
      itemCount={itemCount}
      onlineCount={onlineCount}
      onOpen={onOpen}
      onEdit={onEdit}
    />
  );
}

export function GroupWallCreateListRow({
  onClick,
  label = "New group",
  hint = "Organize screens",
}: {
  onClick: () => void;
  label?: string;
  hint?: string;
}) {
  return (
    <li className="device-group-wall-list-row device-group-wall-list-row--create">
      <button type="button" onClick={onClick} className="device-group-wall-list-row__hit" aria-label={label}>
        <span className="device-group-wall-list-row__wall device-group-wall-list-row__wall--create" aria-hidden>
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