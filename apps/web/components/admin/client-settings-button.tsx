import Link from "next/link";
import { Wrench } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ClientSettingsButton({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  return (
    <Tooltip label="Client settings">
      <Link
        href={`/admin/clients/${userId}`}
        aria-label="Client settings"
        className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 w-8 shrink-0 p-0", className)}
      >
        <Wrench className="h-4 w-4" aria-hidden />
      </Link>
    </Tooltip>
  );
}
