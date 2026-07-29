import { Download } from "lucide-react";

/**
 * Points at the short public redirect `/apk`, which resolves the active TV build
 * server-side so the shareable URL never embeds a versioned MinIO path.
 */
export function LandingDownloadButton({ className }: { className?: string }) {
  return (
    <a href="/apk" className={className}>
      <Download size={16} strokeWidth={2.5} />
      Download app
    </a>
  );
}
