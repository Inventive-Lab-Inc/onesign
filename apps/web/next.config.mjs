/** @type {import('next').NextConfig} */
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
      dynamic: 30,
      static: 180,
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

export default nextConfig;
