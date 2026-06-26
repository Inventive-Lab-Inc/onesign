import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Centers page content and caps width at the design measure (max-w-content).
 * Gutters live on <main> in AppLayout; this layer only handles measure + centering.
 */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-content", className)}>{children}</div>;
}
