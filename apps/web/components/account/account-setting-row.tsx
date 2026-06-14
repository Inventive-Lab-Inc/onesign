import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountSettingRow({
  icon: Icon,
  title,
  description,
  control,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "account-setting-row flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5 sm:py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-faint20 bg-brand-soft text-brand-strong shadow-sm"
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pl-12 sm:pl-0">{control}</div>
    </div>
  );
}
