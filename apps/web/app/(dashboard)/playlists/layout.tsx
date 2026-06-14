import { Suspense } from "react";
import { PlaylistsWorkspace } from "@/components/playlists/playlists-workspace";

function PlaylistsLayoutFallback() {
  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col gap-6 lg:flex-row lg:gap-8">
      <div className="hidden w-56 shrink-0 space-y-4 xl:w-60 lg:block">
        <div className="h-[4.25rem] animate-pulse rounded-xl bg-muted" />
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="min-h-[240px] flex-1 animate-pulse rounded-xl border border-border bg-muted/40" />
    </div>
  );
}

export default function PlaylistsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PlaylistsLayoutFallback />}>
      <PlaylistsWorkspace>{children}</PlaylistsWorkspace>
    </Suspense>
  );
}
