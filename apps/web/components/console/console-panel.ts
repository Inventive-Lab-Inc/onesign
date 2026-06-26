"use client";

import { useBreakpoint } from "@/components/shell/use-breakpoint";
import { useSettings } from "@/components/shell/settings-context";

/** Card chrome wrapping a page's main content panel in top-bar / mobile layouts. */
export const CONSOLE_PANEL_CHROME = "rounded-xl border border-border bg-card shadow-sm";

/**
 * In the desktop sidebar layout the shell already frames the content, so the
 * per-page container card is dropped and content sits flat on the surface.
 */
export function useFlatConsolePanels() {
  const { settings } = useSettings();
  const { isMobile } = useBreakpoint();
  return !isMobile && settings.layoutMode === "sidebar";
}
