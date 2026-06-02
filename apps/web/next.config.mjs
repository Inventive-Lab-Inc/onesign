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

const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ?? "",
  },
  reactStrictMode: true,
  transpilePackages: ["@signage/types"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Reuse recent RSC payloads on client navigations (softens repeat clicks between pages).
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
