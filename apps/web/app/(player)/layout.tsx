import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "OneSign Player",
  description: "Turn any browser screen into a OneSign display",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#012218",
};

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#012218] text-white">{children}</div>
  );
}
