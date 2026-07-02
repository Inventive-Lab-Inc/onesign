import { Logo } from "@/components/logo";

interface AuthBrandHeaderProps {
  variant?: "form" | "hero" | "hero-light";
  logoHeight?: number;
}

export function AuthBrandHeader({ variant = "form", logoHeight }: AuthBrandHeaderProps) {
  const isHeroRow = variant === "hero" || variant === "hero-light";
  const isOnDark = variant === "hero";
  const height = logoHeight ?? (isHeroRow ? 52 : 40);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isHeroRow ? "flex-start" : "center",
        marginBottom: isHeroRow ? 0 : "0.75rem",
      }}
    >
      <Logo height={height} tone={isOnDark ? "light" : "dark"} />
    </div>
  );
}
