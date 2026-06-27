"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderPrimaryButtonProps extends Omit<ButtonProps, "children"> {
  /** Action label rendered as a title-style heading beside the button. */
  label: string;
  /** Icon shown inside the compact square button. */
  icon: ReactNode;
}

/**
 * Header CTA shown as a title-style label next to a compact icon-only button,
 * e.g. "Link screen  [+]". Sits beside the page title via `ListPageHeader`.
 */
export function HeaderPrimaryButton({ label, icon, className, ...props }: HeaderPrimaryButtonProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="whitespace-nowrap text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {label}
      </span>
      <Button aria-label={label} className={cn("h-9 w-9 shrink-0 p-0", className)} {...props}>
        {icon}
      </Button>
    </div>
  );
}
