export type DeviceDisabledPresentation = {
  show: boolean;
  accountSuspended: boolean;
  pausedByQuota: boolean;
};

export function DeviceDisabledNotice({
  canControlPlayback = false,
  pausedByQuota = false,
  accountSuspended = false,
}: {
  canControlPlayback?: boolean;
  pausedByQuota?: boolean;
  accountSuspended?: boolean;
}) {
  if (accountSuspended) {
    return (
      <div
        role="status"
        className="rounded-xl border border-red-500/35 bg-red-500/8 px-4 py-3 text-sm text-red-950 dark:text-red-100"
      >
        <p>
          This screen is paused because the client account is suspended. Re-enable the account to
          resume playback.
        </p>
      </div>
    );
  }

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
          This screen is disabled. Select <span className="font-medium">Enable Device</span> to turn
          playback back on.
        </p>
      ) : (
        <p>
          This screen was disabled by an admin. Contact admin if you need it restored.
        </p>
      )}
    </div>
  );
}

const deviceStatusChipClass =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide";

export function DeviceDisabledBadge({
  pausedByQuota = false,
  accountSuspended = false,
}: {
  pausedByQuota?: boolean;
  accountSuspended?: boolean;
}) {
  if (accountSuspended) {
    return (
      <span className={`${deviceStatusChipClass} bg-red-500/15 text-red-800 dark:text-red-200`}>
        Suspended
      </span>
    );
  }

  if (pausedByQuota) {
    return (
      <span className={`${deviceStatusChipClass} bg-red-500/15 text-red-800 dark:text-red-200`}>
        Paused
      </span>
    );
  }

  return (
    <span className={`${deviceStatusChipClass} bg-amber-500/15 text-amber-900 dark:text-amber-100`}>
      Screen disabled
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

export function isDeviceEffectivelyPlaybackDisabled(
  device: {
    playback_disabled?: boolean | null;
    paused_by_quota?: boolean | null;
  },
  accountDisabled = false,
): boolean {
  return accountDisabled || isDevicePlaybackDisabled(device);
}

export function deviceDisabledPresentation(
  device: {
    playback_disabled?: boolean | null;
    paused_by_quota?: boolean | null;
  },
  accountDisabled = false,
): DeviceDisabledPresentation {
  if (accountDisabled) {
    return { show: true, accountSuspended: true, pausedByQuota: false };
  }

  if (!isDevicePlaybackDisabled(device)) {
    return { show: false, accountSuspended: false, pausedByQuota: false };
  }

  return {
    show: true,
    accountSuspended: false,
    pausedByQuota: isDevicePausedByQuota(device),
  };
}
