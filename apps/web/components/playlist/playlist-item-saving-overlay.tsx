import { Loader2 } from "lucide-react";

export function PlaylistItemSavingOverlay({ label = "Adding to playlist…" }: { label?: string }) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] bg-background/85 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" aria-hidden />
      <span className="text-[0.6875rem] font-medium text-foreground">{label}</span>
    </div>
  );
}
