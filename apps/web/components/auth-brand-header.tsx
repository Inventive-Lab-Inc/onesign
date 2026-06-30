import { Logo } from "@/components/logo";

interface AuthBrandHeaderProps {
  variant?: "form" | "hero" | "hero-light";
}

export function AuthBrandHeader({ variant = "form" }: AuthBrandHeaderProps) {
  const isHeroRow = variant === "hero" || variant === "hero-light";
  const isOnDark = variant === "hero";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isHeroRow ? "flex-start" : "center",
        marginBottom: isHeroRow ? 0 : "1.25rem",
      }}
    >
      <Logo height={isHeroRow ? 52 : 40} tone={isOnDark ? "light" : "dark"} />
    </div>
  );
}
