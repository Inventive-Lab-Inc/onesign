import { notFound } from "next/navigation";
import { TvPlayerScreenFromPhase } from "@/components/tv-player/tv-player-screen";
import { deviceUiPhases, getDeviceUiPhase, type DeviceUiPhaseId } from "@/lib/device-ui-phases";

export default function DeviceViewPreviewPage({
  params,
}: {
  params: { phase: string };
}) {
  const phase = getDeviceUiPhase(params.phase as DeviceUiPhaseId);
  if (!phase || !deviceUiPhases.some((entry) => entry.id === params.phase)) {
    notFound();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black">
      <TvPlayerScreenFromPhase
        id={`device-view-${phase.id}`}
        phase={phase}
        scale="full"
        className="h-[720px] w-[1280px]"
      />
    </main>
  );
}
