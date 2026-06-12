export function DeviceDisabledNotice({
  canControlPlayback = false,
  pausedByQuota = false,
}: {
  canControlPlayback?: boolean;
  pausedByQuota?: boolean;
}) {
  if (pausedByQuota) {
    return (
      <div
        role="status"
        className="rounded-xl border border-red-500/35 bg-red-500/8 px-4 py-3 text-sm text-red-950 dark:text-red-100"
      >
        <p>
          This screen is paused because your plan limit was reduced. Contact your administrator to
          activate it or upgrade your screen allocation.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
    >
      {canControlPlayback ? (
        <p>
          This device has been disabled. Select <span className="font-medium">Enable Device</span> to turn it
          back on.
        </p>
      ) : (
        <p>
          This device has been disabled by an administrator. Contact your administrator if you need it
          restored.
        </p>
      )}
    </div>
  );
}

export function DeviceDisabledBadge({ pausedByQuota = false }: { pausedByQuota?: boolean }) {
  if (pausedByQuota) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-500/12 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">
        Plan paused
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
      Disabled
    </span>
  );
}

export function isDevicePlaybackDisabled(device: {
  playback_disabled?: boolean | null;
}): boolean {
  return Boolean(device.playback_disabled);
}

export function isDevicePausedByQuota(device: {
  paused_by_quota?: boolean | null;
}): boolean {
  return Boolean(device.paused_by_quota);
}
