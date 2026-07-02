import { AlertCircle } from "lucide-react";

/** Inline form alert used across the login and signup screens. */
export function AlertBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}
