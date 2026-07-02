"use client";

import type { DeviceScreenOrientation } from "@signage/types";
import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  Pause,
  Play,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { DeviceScreenOrientationIcon } from "@/components/devices/device-screen-orientation-icon";
import { TvPlayerScreenFromPhase } from "@/components/tv-player/tv-player-screen";
import type { DeviceHealthKind } from "@/lib/dashboard-device-health";
import {
  DEVICE_SCREEN_ORIENTATION_ROTATION,
  DEVICE_SCREEN_ORIENTATIONS,
  formatDeviceScreenOrientationSubtitle,
} from "@/lib/device-screen-orientation";
import {
  deviceUiPhaseGroups,
  deviceUiPhases,
  type DeviceUiPhase,
  type DeviceUiPhaseGroup,
} from "@/lib/device-ui-phases";
import { cn } from "@/lib/utils";
import "@/components/devices/device-tv-frame.css";

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;
const AUTO_ADVANCE_MS = 5000;
/** Outer TV mockup box (panel + stand footprint). */
const TV_PREVIEW_ASPECT = 16 / 10;

function maxTvPreviewWidth(stageWidth: number, stageHeight: number, rotation: number): number {
  if (stageWidth <= 0 || stageHeight <= 0) return 0;

  const visualWidthFactor = rotation % 180 === 0 ? 1 : 10 / 16;
  const visualHeightFactor = rotation % 180 === 0 ? 10 / 16 : 1;

  return Math.min(stageWidth / visualWidthFactor, stageHeight / visualHeightFactor);
}

function usePreviewTvWidth(stageRef: RefObject<HTMLElement | null>, rotation: number) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const update = () => {
      const { width: stageWidth, height: stageHeight } = stage.getBoundingClientRect();
      setWidth(Math.floor(maxTvPreviewWidth(stageWidth, stageHeight, rotation) * 0.98));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [rotation, stageRef]);

  return width;
}

const orientationChipLabels: Record<DeviceScreenOrientation, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
  reverse_landscape: "180°",
  reverse_portrait: "270°",
};

const healthChipStyles: Record<DeviceHealthKind, string> = {
  playing:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  idle: "border-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-100",
  offline: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
  offline_expected: "border-border bg-muted/50 text-muted-foreground",
  off_hours: "border-violet-500/25 bg-violet-500/10 text-violet-900 dark:text-violet-100",
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  paused: "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200",
  disabled: "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  suspended: "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200",
};

function ConsoleHealthChip({ health }: { health: DeviceHealthKind }) {
  const labels: Record<DeviceHealthKind, string> = {
    playing: "Playing",
    idle: "No content",
    offline: "Unreachable",
    offline_expected: "Offline",
    off_hours: "Off-hours",
    pending: "Pending setup",
    paused: "Plan limit",
    disabled: "Playback off",
    suspended: "Account suspended",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold",
        healthChipStyles[health],
      )}
    >
      Console: {labels[health]}
    </span>
  );
}

function ScaledTvPlayer({ phase }: { phase: DeviceUiPhase }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = screenRef.current;
    if (!node) return;

    const updateScale = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      if (width <= 0 || height <= 0) return;
      setScale(Math.min(width / SLIDE_WIDTH, height / SLIDE_HEIGHT));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={screenRef} className="absolute inset-0 overflow-hidden bg-black">
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: SLIDE_WIDTH * scale,
            height: SLIDE_HEIGHT * scale,
          }}
        >
          <div
            style={{
              width: SLIDE_WIDTH,
              height: SLIDE_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <TvPlayerScreenFromPhase
              phase={phase}
              scale="full"
              className="h-[720px] w-[1280px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TvSlideshowFrame({
  phase,
  orientation,
}: {
  phase: DeviceUiPhase;
  orientation: DeviceScreenOrientation;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rotation = DEVICE_SCREEN_ORIENTATION_ROTATION[orientation];
  const tvWidth = usePreviewTvWidth(stageRef, rotation);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,hsl(var(--muted)/0.35)_0%,hsl(var(--muted)/0.15)_100%)] shadow-lg ring-1 ring-border/60">
      <div
        ref={stageRef}
        className="relative grid min-h-[min(56vh,44rem)] w-full place-items-center px-2 py-4 sm:min-h-[min(62vh,48rem)] sm:px-4 sm:py-6"
      >
        <div
          className="shrink-0 transition-transform duration-300 ease-out"
          style={{
            width: tvWidth > 0 ? tvWidth : "min(100%, 36rem)",
            aspectRatio: `${TV_PREVIEW_ASPECT}`,
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
          }}
        >
          <div className="relative h-full w-full">
            <div className="device-tv-frame-wrap device-tv-frame-wrap--tight">
              <div className="device-tv-frame device-tv-frame--compact">
                <div className="device-tv-frame__panel">
                  <div className="device-tv-frame__screen !bg-black">
                    <ScaledTvPlayer key={`${phase.id}-${orientation}`} phase={phase} />
                  </div>
                </div>
                <div className="device-tv-frame__stand" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type GroupFilter = DeviceUiPhaseGroup | "all";

export function DeviceViewTvSlideshow() {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [orientation, setOrientation] = useState<DeviceScreenOrientation>("landscape");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const filteredPhases = useMemo(
    () =>
      groupFilter === "all"
        ? deviceUiPhases
        : deviceUiPhases.filter((phase) => phase.group === groupFilter),
    [groupFilter],
  );

  const currentPhase = filteredPhases[phaseIndex] ?? filteredPhases[0];

  useEffect(() => {
    setPhaseIndex(0);
  }, [groupFilter]);

  useEffect(() => {
    if (phaseIndex >= filteredPhases.length) {
      setPhaseIndex(0);
    }
  }, [filteredPhases.length, phaseIndex]);

  const goNext = useCallback(() => {
    setPhaseIndex((index) => (index + 1) % filteredPhases.length);
  }, [filteredPhases.length]);

  const goPrev = useCallback(() => {
    setPhaseIndex((index) => (index - 1 + filteredPhases.length) % filteredPhases.length);
  }, [filteredPhases.length]);

  useEffect(() => {
    if (!playing || filteredPhases.length <= 1) return;
    const timer = window.setInterval(goNext, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [playing, goNext, filteredPhases.length, currentPhase?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  if (!currentPhase) return null;

  const groupLabel =
    deviceUiPhaseGroups.find((group) => group.id === currentPhase.group)?.label ?? currentPhase.group;

  return (
    <div className="w-full space-y-5 pb-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-brand-strong" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Device View</h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Proposed OneSign TV screens in a single preview. Step through each state and switch
          orientation to match how the screen is mounted.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Orientation</p>
        <div className="flex flex-wrap gap-2">
          {DEVICE_SCREEN_ORIENTATIONS.map((value) => (
            <FilterChip
              key={value}
              active={orientation === value}
              onClick={() => setOrientation(value)}
            >
              <span className="inline-flex items-center gap-1.5">
                <DeviceScreenOrientationIcon orientation={value} />
                {orientationChipLabels[value]}
              </span>
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Screen state</p>
        <div className="flex flex-wrap gap-2">
        <FilterChip active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
          All
        </FilterChip>
        {deviceUiPhaseGroups.map((group) => (
          <FilterChip
            key={group.id}
            active={groupFilter === group.id}
            onClick={() => setGroupFilter(group.id)}
          >
            {group.label}
          </FilterChip>
        ))}
        </div>
      </div>

      <TvSlideshowFrame phase={currentPhase} orientation={orientation} />

      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label="Previous screen"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label="Next screen"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm tabular-nums text-muted-foreground">
              {phaseIndex + 1} / {filteredPhases.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filteredPhases.map((phase, index) => (
              <button
                key={phase.id}
                type="button"
                onClick={() => setPhaseIndex(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  index === phaseIndex ? "bg-brand-strong" : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
                aria-label={`Show ${phase.title}`}
                aria-current={index === phaseIndex ? "true" : undefined}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {groupLabel}
            </span>
            <h2 className="text-base font-semibold text-foreground">{currentPhase.title}</h2>
            {currentPhase.consoleHealth ? (
              <ConsoleHealthChip health={currentPhase.consoleHealth} />
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
              <DeviceScreenOrientationIcon orientation={orientation} className="h-3.5 w-3.5" />
              {formatDeviceScreenOrientationSubtitle(orientation)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {currentPhase.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand-strong/30 bg-brand-strong/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
