"use client";

import { useEffect, useRef } from "react";

import { LOGIN_ABSOLUTE_MAX_SCALE } from "@/lib/auth/login-viewport";

const VIEWPORT_BASE = "width=device-width, initial-scale=1, user-scalable=yes";

function applyMaxScale(max: number) {
  const clamped = Math.max(1, Math.min(LOGIN_ABSOLUTE_MAX_SCALE, max));
  const content = `${VIEWPORT_BASE}, maximum-scale=${clamped.toFixed(2)}`;
  const meta =
    document.querySelector('meta[name="viewport"]') ??
    (() => {
      const el = document.createElement("meta");
      el.setAttribute("name", "viewport");
      document.head.appendChild(el);
      return el;
    })();

  if (meta.getAttribute("content") !== content) {
    meta.setAttribute("content", content);
  }

  return clamped;
}

function isScrollerStable(scroller: HTMLElement): boolean {
  const anchors = scroller.querySelectorAll("[data-auth-anchor]");
  if (anchors.length === 0) return true;

  const firstEl = anchors[0];
  const lastEl = anchors[anchors.length - 1];
  if (!firstEl || !lastEl) return true;

  const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const scrollerRect = scroller.getBoundingClientRect();
  const first = firstEl.getBoundingClientRect();
  const last = lastEl.getBoundingClientRect();

  const topClipped = first.top < scrollerRect.top - 2;
  const bottomClipped = last.bottom > scrollerRect.bottom + 2;

  if (!topClipped && !bottomClipped) return true;
  if (bottomClipped) return scroller.scrollTop >= maxScroll - 1;
  if (topClipped) return scroller.scrollTop <= 1;
  return true;
}

function getActiveScroller(): HTMLElement | null {
  const panel = document.querySelector(
    ".auth-card--login .auth-right-panel",
  ) as HTMLElement | null;
  const card = document.querySelector(".auth-card--login") as HTMLElement | null;
  if (!panel) return null;

  if (panel.scrollHeight > panel.clientHeight + 1) return panel;
  if (card && card.scrollHeight > card.clientHeight + 1) return card;
  return panel;
}

function isLoginStable(): boolean {
  const scroller = getActiveScroller();
  if (!scroller) return true;
  return isScrollerStable(scroller);
}

export function LoginZoomGuard() {
  const lockedMaxRef = useRef(LOGIN_ABSOLUTE_MAX_SCALE);

  useEffect(() => {
    document.documentElement.classList.add("auth-login-page");

    function syncViewportScale() {
      const currentScale = window.visualViewport?.scale ?? 1;
      const stable = isLoginStable();

      if (!stable) {
        lockedMaxRef.current = Math.min(lockedMaxRef.current, currentScale);
      } else if (currentScale <= lockedMaxRef.current - 0.08) {
        lockedMaxRef.current = LOGIN_ABSOLUTE_MAX_SCALE;
      }

      applyMaxScale(lockedMaxRef.current);
    }

    syncViewportScale();

    const observed = getActiveScroller();
    const resizeObserver = new ResizeObserver(() => {
      syncViewportScale();
    });
    if (observed) {
      resizeObserver.observe(observed);
    }

    const card = document.querySelector(".auth-card--login");
    if (card instanceof HTMLElement) {
      resizeObserver.observe(card);
    }

    const panel = document.querySelector(".auth-card--login .auth-right-panel");
    panel?.addEventListener("scroll", syncViewportScale, { passive: true });

    window.visualViewport?.addEventListener("resize", syncViewportScale);
    window.visualViewport?.addEventListener("scroll", syncViewportScale);
    window.addEventListener("resize", syncViewportScale);

    return () => {
      document.documentElement.classList.remove("auth-login-page");
      resizeObserver.disconnect();
      panel?.removeEventListener("scroll", syncViewportScale);
      window.visualViewport?.removeEventListener("resize", syncViewportScale);
      window.visualViewport?.removeEventListener("scroll", syncViewportScale);
      window.removeEventListener("resize", syncViewportScale);
    };
  }, []);

  return null;
}
