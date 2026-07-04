/**
 * On-screen copy for OneSign TV — kept short for 10-foot readability.
 * Web mockups and Android strings.xml should stay aligned with these phrases.
 */
export const deviceUiTvCopy = {
  initializing: {
    message: "Starting…",
  },
  deviceSetup: {
    title: "Allow updates",
    steps: ["Open settings", "Allow installs", "Return here"] as const,
    button: "Settings",
    permissionGranted: "Ready",
    continue: "Continue",
  },
  pairing: {
    title: "Link this screen",
    linkSteps: [
      "Sign in at app.onesigntv.com",
      "Open Screens",
      "Tap + Add screen and enter the code above",
    ] as const,
    waiting: "Waiting…",
  },
  playing: {
    cacheHeadline: "Caching…",
  },
  noPlaylist: {
    badge: "No playlist",
    hint: "Assign in Screens",
  },
  emptyPlaylist: {
    badge: "Empty",
    hint: "Add slides in app",
  },
  offHoursStandby: {
    badge: "Off-hours",
    hint: "Resumes on schedule",
  },
  disabled: {
    badge: "Screen disabled",
    hint: "Contact admin",
  },
  pausedQuota: {
    badge: "Paused by plan limit",
    hint: "Check Billing",
  },
  accountSuspended: {
    badge: "Account suspended",
    hint: "Contact admin",
  },
  missingConfig: {
    badge: "Can't start the app",
    hint: "Reinstall the app",
  },
  errorConnection: {
    badge: "Can't connect to the internet",
    hint: "Check your network",
    action: "Retry",
  },
  slide: {
    loadFailed: "Can't show slide",
    skipping: "Skipping…",
    caching: "Caching…",
  },
} as const;
