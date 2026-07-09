"use client";

import type { Device } from "@signage/types";
import { useMemo, useState } from "react";
import { DeviceSideDrawer } from "@/components/devices/device-side-drawer";
import { DeviceTelemetryPanelContent } from "@/components/device-telemetry-panel";
import { useStaleOnlineTick } from "@/hooks/use-stale-online-tick";
import {
  buildDeviceHistoryEvents,
  buildDeviceInformationRows,
  resolveDeviceDisplayName,
} from "@/lib/device-information";
import { useConsoleDevice } from "@/hooks/use-console-device";
import { cn } from "@/lib/utils";

type DetailsTab = "information" | "history";

const TAB_OPTIONS: { id: DetailsTab; label: string }[] = [
  { id: "information", label: "Information" },
  { id: "history", label: "History" },
];

function InfoRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-3 py-2.5 text-sm">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HistoryTab({ device, lastPlaylistChangeAt }: { device: Device; lastPlaylistChangeAt?: string | null }) {
  const events = useMemo(
    () => buildDeviceHistoryEvents(device, { lastPlaylistChangeAt }),
    [device, lastPlaylistChangeAt],
  );

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No history recorded for this screen yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <li key={`${event.label}-${event.at}`} className="rounded-lg border border-border px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">{event.label}</p>
          {event.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p> : null}
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {new Date(event.at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function DeviceDetailsDrawer({
  device: deviceProp,
  open,
  onClose,
  lastPlaylistChangeAt,
}: {
  device: Device;
  open: boolean;
  onClose: () => void;
  lastPlaylistChangeAt?: string | null;
}) {
  useStaleOnlineTick();

  const deviceFromStore = useConsoleDevice(deviceProp.id);
  const device = deviceFromStore ?? deviceProp;
  const [tab, setTab] = useState<DetailsTab>("information");
  const infoRows = useMemo(
    () => buildDeviceInformationRows(device, { lastPlaylistChangeAt }),
    [device, lastPlaylistChangeAt],
  );

  return (
    <DeviceSideDrawer open={open} onClose={onClose} title="Screen details" subtitle={resolveDeviceDisplayName(device)}>
      <div className="space-y-4">
        <div className="flex gap-1 border-b border-border">
          {TAB_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === option.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {tab === "information" ? (
          <div className="space-y-4">
            <InfoRows rows={infoRows} />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Device telemetry</p>
              <DeviceTelemetryPanelContent device={device} />
            </div>
          </div>
        ) : null}

        {tab === "history" ? <HistoryTab device={device} lastPlaylistChangeAt={lastPlaylistChangeAt} /> : null}
      </div>
    </DeviceSideDrawer>
  );
}
