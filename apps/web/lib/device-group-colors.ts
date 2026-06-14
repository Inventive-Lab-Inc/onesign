/** Curated accent palette for device groups — distinct hues, readable on light/dark UI. */
export const DEVICE_GROUP_COLORS = [
  { id: "emerald", hex: "#047857", label: "Emerald" },
  { id: "cobalt", hex: "#1d4ed8", label: "Cobalt" },
  { id: "amber", hex: "#b45309", label: "Amber" },
  { id: "rose", hex: "#be123c", label: "Rose" },
  { id: "violet", hex: "#6d28d9", label: "Violet" },
  { id: "teal", hex: "#0f766e", label: "Teal" },
  { id: "slate", hex: "#475569", label: "Slate" },
  { id: "orange", hex: "#c2410c", label: "Orange" },
] as const;

export const DEFAULT_GROUP_COLOR = DEVICE_GROUP_COLORS[0].hex;

export function resolveGroupColor(hex: string | null | undefined): string {
  if (!hex) return DEFAULT_GROUP_COLOR;
  const known = DEVICE_GROUP_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return known?.hex ?? hex;
}
