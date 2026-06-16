import { AppReleasesManager } from "@/components/app-releases-manager";

export default function DownloadAppPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-1 pb-4 py-1">
      <h1 className="text-lg font-bold text-foreground">Download App</h1>
      <AppReleasesManager />
    </div>
  );
}
