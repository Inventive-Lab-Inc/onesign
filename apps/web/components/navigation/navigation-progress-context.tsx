"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

/** Only show loading UI if navigation takes longer than this — fast clicks feel instant. */
const NAV_SPINNER_DELAY_MS = 300;

type NavigationProgressContextValue = {
  /** Set immediately on click — use for optimistic active nav styling. */
  optimisticPath: string | null;
  /** Set after delay — use for spinners / progress bar only. */
  pendingPath: string | null;
  beginNavigation: (href: string) => void;
};

const NavigationProgressContext = createContext<NavigationProgressContextValue | null>(null);

function navigationTarget(href: string, origin: string): string | null {
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const activeTargetRef = useRef<string | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNavigation = useCallback(() => {
    activeTargetRef.current = null;
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    setOptimisticPath(null);
    setPendingPath(null);
  }, []);

  const beginNavigation = useCallback(
    (href: string) => {
      if (typeof window === "undefined") return;
      const target = navigationTarget(href, window.location.origin);
      if (!target) return;
      const targetPath = target.split("?")[0] ?? target;
      if (targetPath === pathname) return;
      const current = pathname + window.location.search;
      if (target === current) return;

      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }

      activeTargetRef.current = targetPath;
      setOptimisticPath(targetPath);
      setPendingPath(null);

      delayTimerRef.current = setTimeout(() => {
        if (activeTargetRef.current === targetPath) {
          setPendingPath(targetPath);
        }
      }, NAV_SPINNER_DELAY_MS);
    },
    [pathname],
  );

  useEffect(() => {
    const target = activeTargetRef.current;
    if (!target) return;
    if (pathname !== target) return;
    clearNavigation();
  }, [pathname, clearNavigation]);

  useEffect(() => {
    if (!pendingPath) return;
    const timeout = window.setTimeout(() => clearNavigation(), 12000);
    return () => window.clearTimeout(timeout);
  }, [pendingPath, clearNavigation]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const el = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      if (el.target && el.target !== "_self") return;
      const hrefAttr = el.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;
      beginNavigation(el.href);
    };

    const onPopState = () => {
      beginNavigation(window.location.href);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [beginNavigation]);

  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({
      optimisticPath,
      pendingPath,
      beginNavigation,
    }),
    [optimisticPath, pendingPath, beginNavigation],
  );

  return (
    <NavigationProgressContext.Provider value={value}>{children}</NavigationProgressContext.Provider>
  );
}

export function useNavigationProgress(): NavigationProgressContextValue {
  const ctx = useContext(NavigationProgressContext);
  if (!ctx) {
    throw new Error("useNavigationProgress must be used within NavigationProgressProvider");
  }
  return ctx;
}
