import type { CSSProperties } from "react";

/**
 * Central place for image/logo URLs and theme colors (aligned with Auth Basement template).
 */
export const assets = {
  loginBackgroundValue:
    "https://i.pinimg.com/736x/21/16/59/21165977ebcdc14db9ac23044c721820.jpg",
  layoutBackgroundValue:
    "linear-gradient(145deg, var(--theme-shell-dark) 0%, var(--theme-shell-light) 100%)",
  /** Must match `:root { --theme }` in app/globals.css (use CSS var so one hex drives the app). */
  themePrimary: "var(--theme)",
  themePrimaryContrast: "var(--theme-contrast)",
} as const;

export type AssetsConfig = typeof assets;

const isImageUrl = (v: string) => /^(https?:|\/)/.test(v.trim());

export function getBackgroundStyle(value: string): CSSProperties {
  if (!value) return {};
  if (isImageUrl(value)) {
    return {
      backgroundImage: `url('${value}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return { background: value };
}
