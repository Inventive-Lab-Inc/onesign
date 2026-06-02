import type { LucideIcon } from "lucide-react";

interface BrandMarkProps {
  icon: LucideIcon;
  logoColor?: string;
  iconSize?: number;
  boxWidth?: string;
  boxHeight?: string;
  borderRadius?: string;
}

export function BrandMark({
  icon: Icon,
  logoColor = "var(--theme)",
  iconSize = 17,
  boxWidth = "2.125rem",
  boxHeight = "2rem",
  borderRadius = "0.375rem",
}: BrandMarkProps) {
  return (
    <div
      style={{
        background: logoColor,
        borderRadius,
        width: boxWidth,
        height: boxHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} color="var(--theme-contrast)" strokeWidth={2.5} />
    </div>
  );
}
