"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "signage-console-settings";

export type LayoutMode = "topbar" | "sidebar";

export interface AppSettings {
  notifications: boolean;
  language: string;
  layoutMode: LayoutMode;
  sidebarCollapsed: boolean;
}

const defaults: AppSettings = {
  notifications: true,
  language: "en",
  layoutMode: "topbar",
  sidebarCollapsed: false,
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      notifications: parsed.notifications ?? defaults.notifications,
      language: parsed.language ?? defaults.language,
      layoutMode: parsed.layoutMode === "sidebar" ? "sidebar" : defaults.layoutMode,
      sidebarCollapsed: parsed.sidebarCollapsed ?? defaults.sidebarCollapsed,
    };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export interface SettingsContextValue {
  settings: AppSettings;
  setNotifications: (enabled: boolean) => void;
  setLanguage: (language: string) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(defaults);

  useEffect(() => {
    setSettingsState(loadSettings());
  }, []);

  const persist = useCallback((next: AppSettings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  const setNotifications = useCallback(
    (notifications: boolean) => persist({ ...settings, notifications }),
    [persist, settings],
  );
  const setLanguage = useCallback(
    (language: string) => persist({ ...settings, language }),
    [persist, settings],
  );
  const setLayoutMode = useCallback(
    (layoutMode: LayoutMode) => persist({ ...settings, layoutMode }),
    [persist, settings],
  );
  const setSidebarCollapsed = useCallback(
    (sidebarCollapsed: boolean) => persist({ ...settings, sidebarCollapsed }),
    [persist, settings],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setNotifications,
      setLanguage,
      setLayoutMode,
      setSidebarCollapsed,
    }),
    [settings, setNotifications, setLanguage, setLayoutMode, setSidebarCollapsed],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
