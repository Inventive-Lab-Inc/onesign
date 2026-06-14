"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const backIconButtonClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong shadow-sm transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-brand-onDark";

type BackNavLinkProps = {
  label: string;
  className?: string;
} & (
  | { href: string; onClick?: never }
  | { href?: never; onClick: () => void }
);

export function BackNavLink({ href, label, onClick, className }: BackNavLinkProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(backIconButtonClass, className)}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2.25} />
      </button>
    );
  }

  return (
    <Link href={href} aria-label={label} className={cn(backIconButtonClass, className)}>
      <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2.25} />
    </Link>
  );
}
