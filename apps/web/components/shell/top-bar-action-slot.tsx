"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Lets a page hoist its primary action button into a slot next to the title in
 * the top bar. Used in sidebar mode, where the top bar owns the page heading.
 */
interface TopBarActionSlotValue {
  container: HTMLElement | null;
  setContainer: (el: HTMLElement | null) => void;
}

const TopBarActionSlotContext = createContext<TopBarActionSlotValue | null>(null);

export function TopBarActionSlotProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ container, setContainer }), [container]);
  return <TopBarActionSlotContext.Provider value={value}>{children}</TopBarActionSlotContext.Provider>;
}

export function useTopBarActionSlot() {
  return useContext(TopBarActionSlotContext);
}
