/** @type {import('next').NextConfig} */

import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants.js";

// Local dev only — bypass TLS-inspecting proxies for all server-side HTTPS (Supabase,
// MinIO, Next.js image optimizer). Never set SUPABASE_INSECURE_TLS in production.
if (
  process.env.SUPABASE_INSECURE_TLS === "true" ||
  process.env.DEV_INSECURE_TLS === "true"
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function projectUrlFromAnonKey(anonKey) {
  try {
    const segment = anonKey.split(".")[1];
    if (!segment) return undefined;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    if (payload.ref) return `https://${payload.ref}.supabase.co`;
  } catch {
    // ignore
  }
  return undefined;
}

const supabaseUrl =
  (supabaseAnonKey ? projectUrlFromAnonKey(supabaseAnonKey) : undefined) ||
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

function hostnameFromPublicBaseUrl(raw) {
  try {
    const trimmed = raw?.trim();
    if (!trimmed) return undefined;
    return new URL(trimmed).hostname;
  } catch {
    return undefined;
  }
}

const mediaBaseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim() ?? "";
const releasesBaseUrl = process.env.NEXT_PUBLIC_RELEASES_BASE_URL?.trim() ?? "";

const mediaStorageHost = hostnameFromPublicBaseUrl(mediaBaseUrl);
const releasesStorageHost = hostnameFromPublicBaseUrl(releasesBaseUrl);

const objectStorageRemotePatterns = [];
for (const hostname of new Set([mediaStorageHost, releasesStorageHost].filter(Boolean))) {
  objectStorageRemotePatterns.push({
    protocol: "https",
    hostname,
    pathname: "/**",
  });
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ?? "",
    NEXT_PUBLIC_MEDIA_BASE_URL: mediaBaseUrl,
    NEXT_PUBLIC_RELEASES_BASE_URL: releasesBaseUrl,
  },
  reactStrictMode: true,
  transpilePackages: ["@signage/types"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    staleTimes: {
      dynamic: 300,
      static: 600,
    },
  },
  images: {
    remotePatterns: [
      ...objectStorageRemotePatterns,
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/devices", destination: "/screens", permanent: true },
      { source: "/devices/:id", destination: "/screens/:id", permanent: true },
      {
        source: "/admin/clients/:userId/devices",
        destination: "/admin/clients/:userId/screens",
        permanent: true,
      },
      {
        source: "/admin/clients/:userId/devices/:id",
        destination: "/admin/clients/:userId/screens/:id",
        permanent: true,
      },
    ];
  },
};

// Keep local production builds out of the dev server's working directory.
// `next dev` always serves from `.next`. A local `next build`/`next start` (preflight,
// manual verification) writes to `.next-local` instead, so it can never wipe the chunks
// a running dev server depends on. On Vercel (`VERCEL` is set) we always use `.next`,
// which is what the platform expects.
export default (phase) => {
  const isVercel = Boolean(process.env.VERCEL);
  const isProductionPhase =
    phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER;
  const distDir = !isVercel && isProductionPhase ? ".next-local" : ".next";

  return { ...nextConfig, distDir };
};
