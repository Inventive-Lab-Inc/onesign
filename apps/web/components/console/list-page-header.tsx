"use client";

import { Filter, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterOption = {
  id: string;
  label: string;
};

export function ListPageHeader({
  title,
  subtitle,
  primaryAction,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filterLabel = "Filters",
  filterOptions,
  activeFilterId,
  onFilterChange,
  trailing,
  backButton,
}: {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterLabel?: string;
  filterOptions?: FilterOption[];
  activeFilterId?: string;
  onFilterChange?: (id: string) => void;
  trailing?: ReactNode;
  backButton?: ReactNode;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const hasFilters = filterOptions != null && filterOptions.length > 0 && onFilterChange != null;
  const activeFilter = filterOptions?.find((option) => option.id === activeFilterId);
  const filterActive = activeFilterId != null && activeFilterId !== "all";

  useEffect(() => {
    if (!filterOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFilterOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  return (
    <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          {backButton}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {primaryAction ? <div className="mt-1 shrink-0 sm:mt-0.5">{primaryAction}</div> : null}
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          {hasFilters ? (
            <div ref={filterRef} className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 px-2.5 text-sm font-medium",
                  filterActive && "text-foreground",
                )}
                onClick={() => setFilterOpen((value) => !value)}
                aria-expanded={filterOpen}
              >
                <Filter className="h-4 w-4" aria-hidden />
                {filterActive && activeFilter ? activeFilter.label : filterLabel}
              </Button>
              {filterOpen ? (
                <ul
                  role="listbox"
                  className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
                >
                  {filterOptions.map((option) => {
                    const selected = option.id === activeFilterId;
                    return (
                      <li key={option.id} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                            selected ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                          onClick={() => {
                            onFilterChange(option.id);
                            setFilterOpen(false);
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
          ) : null}

          <div className="relative w-full min-w-0 sm:w-48 lg:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 border-border bg-background pl-8 text-sm"
            />
          </div>

          {trailing}
        </div>
      </div>
    </div>
  );
}
