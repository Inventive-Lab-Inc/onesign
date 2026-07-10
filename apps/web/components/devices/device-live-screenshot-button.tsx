"use client";

import type { Device } from "@signage/types";
import { Camera } from "lucide-react";
import { useState } from "react";
import { ConsoleCenterModal } from "@/components/devices/console-center-modal";
import { DeviceLiveScreenshotPanel } from "@/components/devices/device-live-screenshot";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function DeviceLiveScreenshotButton({
  device,
  compact = false,
  className,
}: {
  device: Device;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip label="Live screenshot">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(compact ? "h-8 w-8 shrink-0 p-0" : "shrink-0 gap-1.5", className)}
          onClick={() => setOpen(true)}
          aria-label="Live screenshot"
        >
          <Camera className="h-4 w-4" aria-hidden />
          {compact ? null : "Screenshot"}
        </Button>
      </Tooltip>
      <ConsoleCenterModal
        open={open}
        onClose={() => setOpen(false)}
        title="Live screenshot"
        icon={<Camera className="h-5 w-5" aria-hidden />}
        size="lg"
      >
        <DeviceLiveScreenshotPanel device={device} active={open} />
      </ConsoleCenterModal>
    </>
  );
}
