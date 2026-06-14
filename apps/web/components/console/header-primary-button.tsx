"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Solid theme-green header CTA — sits beside the page title via `ListPageHeader` `primaryAction`. */
export function HeaderPrimaryButton({ className, size = "sm", ...props }: ButtonProps) {
  return <Button size={size} className={cn("h-9 gap-1.5", className)} {...props} />;
}
