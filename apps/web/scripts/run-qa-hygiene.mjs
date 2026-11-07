#!/usr/bin/env node
/**
 * Ops hygiene: orphan empty screen playlists, stale unclaimed devices, stale online flags.
 *
 * Usage (from apps/web with .env.local loaded):
 *   node scripts/run-qa-hygiene.mjs
 *   node scripts/run-qa-hygiene.mjs --dry-run
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

function loadEnv(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    // optional
  }
}

loadEnv(join(__dirname, "../.env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  if (dryRun) {
    const { count: unpaired } = await admin
      .from("devices")
      .select("id", { count: "exact", head: true })
      .is("owner_id", null);
    const { count: staleOnline } = await admin
      .from("devices")
      .select("id", { count: "exact", head: true })
      .eq("status", "online")
      .lt("last_seen", new Date(Date.now() - 90_000).toISOString());
    console.log(JSON.stringify({ dryRun: true, unpaired, staleOnlineApprox: staleOnline }, null, 2));
    return;
  }

  const [playlists, unpaired, staleOnline] = await Promise.all([
    admin.rpc("cleanup_orphan_empty_screen_playlists"),
    admin.rpc("purge_stale_unclaimed_devices", { p_stale_days: 14 }),
    admin.rpc("mark_all_stale_devices_offline", { p_stale_seconds: 90 }),
  ]);

  const report = {
    orphanEmptyPlaylistsDeleted: playlists.error ? { error: playlists.error.message } : playlists.data,
    staleUnclaimedDevicesPurged: unpaired.error ? { error: unpaired.error.message } : unpaired.data,
    staleOnlineMarkedOffline: staleOnline.error ? { error: staleOnline.error.message } : staleOnline.data,
  };
  console.log(JSON.stringify(report, null, 2));
  if (playlists.error || unpaired.error || staleOnline.error) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
