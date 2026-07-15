"use client";

import { CalendarDays, ImageIcon, ListVideo } from "lucide-react";
import Link from "next/link";
import {
  contentCalendarPath,
  contentLibraryPath,
  contentPlaylistsPath,
  type ContentView,
  useAdminClientRoutes,
} from "@/components/admin/admin-client-route-context";
import { cn } from "@/lib/utils";

interface ContentViewTabsProps {
  activeView: ContentView;
  groupId?: string | null;
  className?: string;
}

export function ContentViewTabs({ activeView, groupId, className }: ContentViewTabsProps) {
  const adminRoutes = useAdminClientRoutes();
  const libraryHref = contentLibraryPath(adminRoutes);
  const playlistsHref = contentPlaylistsPath(adminRoutes, groupId);
  const calendarHref = contentCalendarPath(adminRoutes);

  const tabs = [
    { id: "library" as const, label: "Library", hint: "Upload & manage files", icon: ImageIcon, href: libraryHref },
    { id: "playlists" as const, label: "Playlists", hint: "Build loops for screens", icon: ListVideo, href: playlistsHref },
    { id: "calendar" as const, label: "Calendar", hint: "See what plays when", icon: CalendarDays, href: calendarHref },
  ];

  return (
    <nav
      className={cn("flex gap-1 rounded-xl border border-border bg-muted/30 p-1", className)}
      aria-label="Content sections"
    >
      {tabs.map(({ id, label, hint, icon: Icon, href }) => {
        const active = activeView === id;
        return (
          <Link
            key={id}
            href={href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-2.5 text-center transition sm:flex-row sm:justify-center sm:gap-2 sm:py-2",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
            <span className="text-sm font-semibold">{label}</span>
            <span className="hidden text-xs font-normal text-muted-foreground lg:inline">· {hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
