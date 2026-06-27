"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpDown, Filter, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MenuOption = {
  id: string;
  label: string;
};

function HeaderToolbarMenu({
  label,
  icon: Icon,
  options,
  activeId,
  onChange,
  showActiveLabel = false,
  defaultActiveId,
}: {
  label: string;
  icon: LucideIcon;
  options: MenuOption[];
  activeId: string;
  onChange: (id: string) => void;
  showActiveLabel?: boolean;
  defaultActiveId?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeOption = options.find((option) => option.id === activeId);
  const defaultId = defaultActiveId ?? options[0]?.id;
  const isActive = defaultId != null && activeId !== defaultId;
  const buttonLabel = showActiveLabel && isActive && activeOption ? activeOption.label : label;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {buttonLabel}
      </Button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {options.map((option) => {
            const selected = option.id === activeId;
            return (
              <li key={option.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    selected ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export { HeaderToolbarMenu };

export function ListPageHeader({
  title,
  subtitle,
  primaryAction,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filterLabel = "Filter",
  filterOptions,
  activeFilterId,
  onFilterChange,
  sortLabel = "Sort",
  sortOptions,
  activeSortId,
  onSortChange,
  toolbarStart,
  toolbarEnd,
  filtersContent,
  center,
  trailing,
  backButton,
  titleMenu,
}: {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterLabel?: string;
  filterOptions?: MenuOption[];
  activeFilterId?: string;
  onFilterChange?: (id: string) => void;
  sortLabel?: string;
  sortOptions?: MenuOption[];
  activeSortId?: string;
  onSortChange?: (id: string) => void;
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  filtersContent?: ReactNode;
  center?: ReactNode;
  trailing?: ReactNode;
  backButton?: ReactNode;
  titleMenu?: ReactNode;
}) {
  const hasFiltersDropdown =
    filtersContent == null &&
    filterOptions != null &&
    filterOptions.length > 0 &&
    onFilterChange != null &&
    activeFilterId != null;
  const hasSort = sortOptions != null && sortOptions.length > 0 && onSortChange != null && activeSortId != null;
  const hasSearch = search != null && onSearchChange != null;

  // The top bar already shows the section name, so repeating it in the body is
  // redundant. Nested views (with a back button) keep their title because the
  // top bar only shows the generic section name there.
  const hideTitle = backButton == null;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border px-4 sm:px-5",
        hideTitle ? "py-3 sm:py-3.5" : "py-4 sm:py-5",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {backButton}
          {(!hideTitle || subtitle) ? (
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h1 className={cn("text-xl font-semibold tracking-tight text-foreground sm:text-2xl", hideTitle && "sr-only")}>
                  {title}
                </h1>
                {titleMenu && !hideTitle ? <div className="shrink-0">{titleMenu}</div> : null}
              </div>
              {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          ) : (
            <h1 className="sr-only">{title}</h1>
          )}
          {primaryAction ? <div className="shrink-0">{primaryAction}</div> : null}
        </div>

        {center ? (
          <div className="flex min-w-0 flex-1 justify-center px-2 sm:px-4">{center}</div>
        ) : null}

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
          {titleMenu && hideTitle ? <div className="shrink-0">{titleMenu}</div> : null}
          {toolbarStart}
          {hasSort ? (
            <HeaderToolbarMenu
              label={sortLabel}
              icon={ArrowUpDown}
              options={sortOptions}
              activeId={activeSortId}
              onChange={onSortChange}
              showActiveLabel
              defaultActiveId={sortOptions[0]?.id}
            />
          ) : null}
          {toolbarEnd}
          {filtersContent}
          {hasFiltersDropdown ? (
            <HeaderToolbarMenu
              label={filterLabel}
              icon={Filter}
              options={filterOptions}
              activeId={activeFilterId}
              onChange={onFilterChange}
              defaultActiveId="all"
            />
          ) : null}

          {hasSearch ? (
            <div className="relative w-full min-w-0 sm:w-48 lg:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 border-border bg-background pl-8 text-sm"
              />
            </div>
          ) : null}

          {trailing}
        </div>
      </div>
    </div>
  );
}
