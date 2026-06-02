import { layoutConfig } from "@/lib/config/layout";
import { BrandMark } from "@/components/brand-mark";

interface AuthBrandHeaderProps {
  variant?: "form" | "hero" | "hero-light";
}

export function AuthBrandHeader({ variant = "form" }: AuthBrandHeaderProps) {
  const { name, subtitle, icon, logoColor } = layoutConfig.brand;
  const isHeroRow = variant === "hero" || variant === "hero-light";
  const isOnDark = variant === "hero";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isHeroRow ? "row" : "column",
        alignItems: "center",
        gap: isHeroRow ? "1rem" : "0.75rem",
        marginBottom: isHeroRow ? 0 : "1.25rem",
      }}
    >
      <BrandMark
        icon={icon}
        logoColor={logoColor}
        iconSize={isHeroRow ? 32 : 22}
        boxWidth={isHeroRow ? "4rem" : "2.75rem"}
        boxHeight={isHeroRow ? "3.75rem" : "2.5rem"}
        borderRadius={isHeroRow ? "0.5rem" : undefined}
      />
      <div style={{ textAlign: isHeroRow ? "left" : "center" }}>
        <div
          style={{
            color: isOnDark ? "#fff" : "#111827",
            fontSize: isHeroRow ? "1.625rem" : "1.25rem",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </div>
        {subtitle && (
          <div
            style={{
              color: isOnDark ? "rgba(255,255,255,0.75)" : "#6b7280",
              fontSize: isHeroRow ? "0.75rem" : "0.625rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: "0.125rem",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
