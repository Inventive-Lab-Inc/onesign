/** Opt-in local dev helper for TLS-inspecting proxies. Never set in production. */
function devInsecureTlsEnabled(): boolean {
  return (
    process.env.SUPABASE_INSECURE_TLS === "true" ||
    process.env.DEV_INSECURE_TLS === "true"
  );
}

if (devInsecureTlsEnabled()) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
