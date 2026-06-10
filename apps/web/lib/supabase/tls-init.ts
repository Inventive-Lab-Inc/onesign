/** Opt-in local dev helper for TLS-inspecting proxies. Never set in production. */
if (process.env.SUPABASE_INSECURE_TLS === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
