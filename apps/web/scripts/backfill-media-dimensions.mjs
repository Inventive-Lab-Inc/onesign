#!/usr/bin/env node
/**
 * Backfill media.width_pixels / height_pixels and enrich tags with orientation.
 * Reads apps/web/.env.local for Supabase + public media base URL.
 */
import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(relativePath) {
  const path = resolve(scriptDir, relativePath);
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (process.env[key] == null) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile("../.env.local");

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const mediaBaseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim().replace(/\/$/, "");

if (!supabaseUrl || !serviceRoleKey || !mediaBaseUrl) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_MEDIA_BASE_URL");
  process.exit(1);
}

function publicUrl(storagePath) {
  return `${mediaBaseUrl}/${storagePath
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

async function probeDimensions(url) {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=s=x:p=0",
        url,
      ],
      { timeout: 120_000 },
    );
    const line = stdout.trim().split("\n").find((entry) => entry.includes("x"));
    if (!line) return null;
    const [widthText, heightText] = line.split("x");
    const width = Number(widthText);
    const height = Number(heightText);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return { width, height };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  probe failed: ${message}`);
    return null;
  }
}

function orientationTag(width, height) {
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "square";
}

function mergeTags(existingTags, additions) {
  const seen = new Set();
  const result = [];
  for (const tag of [...(existingTags ?? []), ...additions]) {
    const trimmed = String(tag).trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rows, error } = await supabase
  .from("media")
  .select("id, storage_path, file_type, tags, width_pixels, height_pixels")
  .or("width_pixels.is.null,height_pixels.is.null")
  .order("created_at", { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

if (!rows?.length) {
  console.log("No media rows need dimension backfill.");
  process.exit(0);
}

console.log(`Probing dimensions for ${rows.length} media file(s)...`);

let updated = 0;
for (const row of rows) {
  const url = publicUrl(row.storage_path);
  console.log(`- ${row.id} (${row.file_type})`);
  const dimensions = await probeDimensions(url);
  if (!dimensions) continue;

  const orientation = orientationTag(dimensions.width, dimensions.height);
  const tags = mergeTags(row.tags, [row.file_type, orientation]);

  const { error: updateError } = await supabase
    .from("media")
    .update({
      width_pixels: dimensions.width,
      height_pixels: dimensions.height,
      tags,
    })
    .eq("id", row.id);

  if (updateError) {
    console.error(`  update failed: ${updateError.message}`);
    continue;
  }

  console.log(`  → ${dimensions.width}×${dimensions.height}, tags: ${tags.join(", ")}`);
  updated += 1;
}

console.log(`Done. Updated ${updated}/${rows.length} row(s).`);
