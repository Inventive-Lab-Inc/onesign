import type { Viewport } from "next";
import { LoginZoomGuard } from "@/components/auth/login-zoom-guard";
import { LOGIN_ABSOLUTE_MAX_SCALE } from "@/lib/auth/login-viewport";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: LOGIN_ABSOLUTE_MAX_SCALE,
  userScalable: true,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LoginZoomGuard />
      {children}
    </>
  );
}
