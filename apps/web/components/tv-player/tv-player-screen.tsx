import { Loader2 } from "lucide-react";
import type { DeviceUiPhase } from "@/lib/device-ui-phases";
import { getDeviceUiPhase, type DeviceUiPhaseId } from "@/lib/device-ui-phases";
import { deviceUiTvCopy as copy } from "@/lib/device-ui-copy";
import {
  TV_PLAYER_ACCENT,
  TV_PLAYER_BG,
  TvPlayerBrandStandby,
  TvPlayerLoadProgressOverlay,
  TvPlayerPairingCode,
  TvPlayerScreenShell,
  TvPlayerTrialWatermark,
} from "@/components/tv-player/tv-player-branding";
import { cn } from "@/lib/utils";

type Scale = "card" | "full";

type TvPlayerScreenProps = {
  phaseId: DeviceUiPhaseId;
  message?: string;
  hint?: string;
  badge?: string;
  deviceName?: string;
  errorCode?: string;
  statusLine?: string;
  pairingCode?: string;
  showWaitingIndicator?: boolean;
  primaryAction?: string;
  scale?: Scale;
  className?: string;
  id?: string;
};

function phaseProps(
  phaseId: DeviceUiPhaseId,
  overrides: Partial<TvPlayerScreenProps>,
): Required<
  Pick<
    TvPlayerScreenProps,
    | "message"
    | "hint"
    | "badge"
    | "deviceName"
    | "errorCode"
    | "statusLine"
    | "pairingCode"
    | "showWaitingIndicator"
    | "primaryAction"
  >
> {
  const phase = getDeviceUiPhase(phaseId);
  return {
    message: overrides.message ?? phase?.tvMessage ?? "",
    hint: overrides.hint ?? phase?.tvHint ?? "",
    badge: overrides.badge ?? phase?.tvBadge ?? "",
    deviceName: overrides.deviceName ?? phase?.tvDeviceName ?? "",
    errorCode: overrides.errorCode ?? phase?.tvErrorCode ?? "",
    statusLine: overrides.statusLine ?? phase?.tvStatusLine ?? "",
    pairingCode: overrides.pairingCode ?? phase?.tvPairingCode ?? "378694",
    showWaitingIndicator: overrides.showWaitingIndicator ?? phase?.tvShowWaitingIndicator ?? false,
    primaryAction: overrides.primaryAction ?? phase?.tvPrimaryAction ?? "",
  };
}

function InitializingScreen({
  scale,
  message,
  statusLine,
}: {
  scale: Scale;
  message: string;
  statusLine?: string;
}) {
  const styles =
    scale === "full"
      ? {
          spinner: "h-12 w-12",
          body: "mt-6 text-[1.125rem] text-[#63AB97]",
          status: "mt-2 text-base text-[#96BFB2]",
        }
      : {
          spinner: "h-6 w-6",
          body: "mt-3 text-[0.65rem] text-[#63AB97]",
          status: "mt-1 text-[0.55rem] text-[#96BFB2]",
        };

  return (
    <TvPlayerScreenShell scale={scale}>
      <Loader2 className={cn("animate-spin", styles.spinner)} style={{ color: TV_PLAYER_ACCENT }} />
      <p className={styles.body}>{message}</p>
      {statusLine ? <p className={styles.status}>{statusLine}</p> : null}
    </TvPlayerScreenShell>
  );
}

function DeviceSetupScreen({ scale }: { scale: Scale }) {
  const isFull = scale === "full";
  const title = isFull ? "text-[2rem] leading-tight" : "text-[0.72rem]";
  const step = isFull ? "text-[1.625rem] leading-snug" : "text-[0.55rem] leading-snug";
  const stepNumber = isFull ? "h-11 w-11 text-xl" : "h-4 w-4 text-[0.45rem]";
  const button = isFull ? "text-[1.25rem] px-10 py-3.5" : "text-[0.55rem] px-3 py-1.5";

  return (
    <TvPlayerScreenShell scale={scale}>
      <div className="mx-auto w-full max-w-[56%]">
        <p className={cn("font-semibold text-[#63AB97]", title)}>{copy.deviceSetup.title}</p>
        <ol className={cn("mx-auto mt-8 flex w-fit flex-col", isFull ? "gap-6" : "gap-3")}>
          {copy.deviceSetup.steps.map((stepText, index) => {
            const isActive = index === 0;
            return (
              <li key={stepText} className={cn("flex items-center", isFull ? "gap-4" : "gap-2")}>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-full border font-semibold",
                    stepNumber,
                    isActive ? "text-[#F5FAF8]" : "bg-transparent text-[#63AB97]",
                  )}
                  style={
                    isActive
                      ? {
                          borderColor: TV_PLAYER_ACCENT,
                          backgroundColor: TV_PLAYER_ACCENT,
                        }
                      : { borderColor: `${TV_PLAYER_ACCENT}4d` }
                  }
                >
                  {index + 1}
                </span>
                <span className={cn(isActive ? "font-medium text-[#63AB97]" : "text-[#96BFB2]", step)}>
                  {stepText}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-10 flex justify-center">
          <div
            className={cn(
              "inline-flex min-w-[11rem] items-center justify-center rounded-md font-semibold text-[#F5FAF8]",
              button,
            )}
            style={{ backgroundColor: TV_PLAYER_ACCENT }}
          >
            {copy.deviceSetup.button}
          </div>
        </div>
      </div>
    </TvPlayerScreenShell>
  );
}

function PairingScreen({
  scale,
  deviceName,
  pairingCode,
  showWaitingIndicator,
}: {
  scale: Scale;
  deviceName?: string;
  pairingCode: string;
  showWaitingIndicator?: boolean;
}) {
  const isFull = scale === "full";
  const title = isFull ? "text-[2rem] leading-tight" : "text-[0.72rem]";
  const deviceClass = isFull ? "text-[1.125rem] leading-snug" : "text-[0.55rem]";
  const stepClass = isFull ? "text-[1.25rem] leading-snug" : "text-[0.55rem] leading-snug";
  const waitingClass = isFull ? "text-[1.125rem]" : "text-[0.55rem]";
  const waitingIcon = isFull ? "h-5 w-5" : "h-2.5 w-2.5";

  return (
    <TvPlayerScreenShell scale={scale}>
      <div className="mx-auto w-full max-w-[80%]">
        <p className={cn("font-medium text-white", title)}>{copy.pairing.title}</p>

        <div className={cn("mt-8 flex justify-center", isFull && "mt-10")}>
          <TvPlayerPairingCode code={pairingCode} scale={scale} />
        </div>

        <ol
          className={cn(
            "relative mx-auto mt-8 flex w-fit flex-col border-l border-white/15 text-left",
            isFull ? "gap-4 pl-6" : "gap-2 pl-3",
          )}
        >
          {copy.pairing.linkSteps.map((step, index) => (
            <li key={step} className={cn("relative text-white/55", stepClass)}>
              <span
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 rounded-full bg-white/80",
                  isFull ? "-left-[1.625rem] size-2" : "-left-[0.8125rem] size-1",
                )}
                aria-hidden
              />
              <span className="text-white/35">{index + 1}.</span> {step}
            </li>
          ))}
        </ol>

        {showWaitingIndicator ? (
          <div className={cn("mt-8 inline-flex items-center gap-3 text-white/55", waitingClass)}>
            <Loader2 className={cn("animate-spin text-white/70", waitingIcon)} />
            {copy.pairing.waiting}
          </div>
        ) : null}
      </div>
    </TvPlayerScreenShell>
  );
}

function PlayingScreen({ scale }: { scale: Scale }) {
  return (
    <div className="relative h-full w-full">
      <TvPlayerScreenShell scale={scale}>
        <TvPlayerLoadProgressOverlay
          scale={scale}
          headline={copy.playing.cacheHeadline}
          percent={64}
        />
      </TvPlayerScreenShell>
      <TvPlayerTrialWatermark scale={scale} />
    </div>
  );
}

function StandbyScreen({
  scale,
  message,
  hint,
  badge,
  deviceName,
  errorCode,
  primaryAction,
}: {
  scale: Scale;
  message?: string;
  hint?: string;
  badge?: string;
  deviceName?: string;
  errorCode?: string;
  primaryAction?: string;
}) {
  return (
    <TvPlayerScreenShell scale={scale}>
      <TvPlayerBrandStandby
        scale={scale}
        message={message}
        hint={hint}
        badge={badge}
        deviceName={deviceName}
        errorCode={errorCode}
        primaryAction={primaryAction}
      />
    </TvPlayerScreenShell>
  );
}

export function TvPlayerScreen({
  phaseId,
  message,
  hint,
  badge,
  deviceName,
  errorCode,
  statusLine,
  pairingCode,
  showWaitingIndicator,
  primaryAction,
  scale = "card",
  className,
  id,
}: TvPlayerScreenProps) {
  const props = phaseProps(phaseId, {
    message,
    hint,
    badge,
    deviceName,
    errorCode,
    statusLine,
    pairingCode,
    showWaitingIndicator,
    primaryAction,
  });

  let content: React.ReactNode;

  switch (phaseId) {
    case "initializing":
      content = (
        <InitializingScreen
          scale={scale}
          message={props.message || "Starting…"}
          statusLine={props.statusLine || undefined}
        />
      );
      break;
    case "device-setup":
      content = <DeviceSetupScreen scale={scale} />;
      break;
    case "pairing":
      content = (
        <PairingScreen
          scale={scale}
          deviceName={props.deviceName || undefined}
          pairingCode={props.pairingCode}
          showWaitingIndicator={props.showWaitingIndicator}
        />
      );
      break;
    case "playing":
      content = <PlayingScreen scale={scale} />;
      break;
    case "no-playlist":
    case "empty-playlist":
    case "off-hours-standby":
    case "disabled":
    case "paused-quota":
    case "account-suspended":
      content = (
        <StandbyScreen
          scale={scale}
          message={props.message || undefined}
          hint={props.hint || undefined}
          badge={props.badge || undefined}
          deviceName={props.deviceName || undefined}
        />
      );
      break;
    case "missing-config":
    case "error-connection":
      content = (
        <StandbyScreen
          scale={scale}
          badge={props.badge || undefined}
          hint={props.hint || undefined}
          primaryAction={props.primaryAction || undefined}
        />
      );
      break;
    case "off-hours-blank":
      content = <div className="h-full w-full bg-black" />;
      break;
    default:
      content = null;
  }

  return (
    <div
      id={id}
      className={cn("relative overflow-hidden", className)}
      style={{
        aspectRatio: className ? undefined : "16 / 9",
        background: phaseId === "off-hours-blank" ? "#000" : TV_PLAYER_BG,
      }}
    >
      {content}
    </div>
  );
}

/** Convenience wrapper when you already have a full phase definition. */
export function TvPlayerScreenFromPhase({
  phase,
  scale = "card",
  className,
  id,
}: {
  phase: DeviceUiPhase;
  scale?: Scale;
  className?: string;
  id?: string;
}) {
  return (
    <TvPlayerScreen
      id={id}
      phaseId={phase.id}
      message={phase.tvMessage}
      hint={phase.tvHint}
      badge={phase.tvBadge}
      deviceName={phase.tvDeviceName}
      errorCode={phase.tvErrorCode}
      statusLine={phase.tvStatusLine}
      pairingCode={phase.tvPairingCode}
      showWaitingIndicator={phase.tvShowWaitingIndicator}
      primaryAction={phase.tvPrimaryAction}
      scale={scale}
      className={className}
    />
  );
}
