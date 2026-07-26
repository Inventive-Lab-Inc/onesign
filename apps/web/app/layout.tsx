import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppProviders } from "@/app/providers";
import { MicrosoftClarity } from "@/components/analytics/microsoft-clarity";
import { getSupabaseConnectEnv } from "@/lib/supabase/env";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";

const siteTitle = "OneSign — Digital Signage Software for Cafés, Restaurants & Retail";
const siteDescription =
  "Manage every TV screen from one dashboard. Build playlists, schedule menus and promos, and publish instantly across all your locations. 14-day free trial, no credit card required.";

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: "%s | OneSign",
  },
  description: siteDescription,
  icons: {
    icon: [{ url: "/images/onesign-brand-mark.svg", type: "image/svg+xml" }],
    shortcut: "/images/onesign-brand-mark.svg",
    apple: "/images/onesign-brand-mark.svg",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    siteName: "OneSign",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabaseConnect = getSupabaseConnectEnv();
  const supabaseBootstrap =
    supabaseConnect &&
    `window.__SIGNAGE_SUPABASE__=${JSON.stringify(supabaseConnect)};`;

  return (
    <html lang="en">
      <head>
        {supabaseBootstrap ? (
          <script dangerouslySetInnerHTML={{ __html: supabaseBootstrap }} />
        ) : null}
      </head>
      <body className="font-sans antialiased">
        <MicrosoftClarity />
        <AppProviders>{children}</AppProviders>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
