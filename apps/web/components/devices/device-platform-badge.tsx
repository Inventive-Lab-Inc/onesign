import type { DevicePlatform } from "@signage/types";
import { Globe, Tv } from "lucide-react";
import { cn } from "@/lib/utils";

export function DevicePlatformBadge({
  platform,
  className,
}: {
  platform?: DevicePlatform | null;
  className?: string;
}) {
  const isBrowser = platform === "browser";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide",
        isBrowser
          ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {isBrowser ? (
        <Globe className="h-3 w-3" aria-hidden />
      ) : (
        <Tv className="h-3 w-3" aria-hidden />
      )}
      {isBrowser ? "Browser" : "Android"}
    </span>
  );
}
