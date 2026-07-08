import { ExternalLink, Globe } from "lucide-react";
import { AppReleasesManager } from "@/components/app-releases-manager";
import { buttonVariants } from "@/components/ui/button";
import { playerUrl } from "@/lib/site-hosts";
import { cn } from "@/lib/utils";

export default function DownloadAppPage() {
  return (
    <div className="space-y-6 py-1">
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-foreground">Download App</h1>
        <p className="text-sm text-muted-foreground">
          Install the Android TV app or use any browser as a screen.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
              <Globe className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Use a browser</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the player on any computer, tablet, or smart display. Pair with the same
                six-digit code as the Android app.
              </p>
            </div>
          </div>
          <a
            href={playerUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "shrink-0 gap-2")}
          >
            Open player
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </section>

      <AppReleasesManager />
    </div>
  );
}
