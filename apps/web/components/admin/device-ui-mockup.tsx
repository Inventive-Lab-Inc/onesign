"use client";

import { TvPlayerScreenFromPhase } from "@/components/tv-player/tv-player-screen";
import { getDeviceUiPhase, type DeviceUiPhaseId } from "@/lib/device-ui-phases";
import { cn } from "@/lib/utils";

export function DeviceUiMockup({
  phaseId,
  message,
  hint,
  className,
}: {
  phaseId: DeviceUiPhaseId;
  message?: string;
  hint?: string;
  className?: string;
}) {
  const phase = getDeviceUiPhase(phaseId);
  if (!phase) return null;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/80 shadow-sm", className)}>
      <TvPlayerScreenFromPhase
        phase={{
          ...phase,
          tvMessage: message ?? phase.tvMessage,
          tvHint: hint ?? phase.tvHint,
        }}
        scale="card"
      />
    </div>
  );
}
