#!/usr/bin/env node
/**
 * Captures PNG reference screenshots for each proposed TV player phase mockup.
 * Requires the web dev server at BASE_URL (default http://127.0.0.1:3000).
 *
 * Usage:
 *   node scripts/capture-device-view-screenshots.mjs
 *   BASE_URL=http://localhost:3000 node scripts/capture-device-view-screenshots.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, "../public/images/device-view");
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const phases = [
  "initializing",
  "device-setup",
  "pairing",
  "playing",
  "no-playlist",
  "empty-playlist",
  "off-hours-blank",
  "off-hours-standby",
  "disabled",
  "paused-quota",
  "account-suspended",
  "missing-config",
  "error-connection",
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
});

for (const phase of phases) {
  const url = `${baseUrl}/device-view-preview/${phase}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(`#device-view-${phase}`, { timeout: 15_000 });
  await page.waitForTimeout(300);
  const target = page.locator(`#device-view-${phase}`);
  const buffer = await target.screenshot({ type: "png" });
  const filePath = path.join(outputDir, `${phase}.png`);
  await writeFile(filePath, buffer);
  console.log(`Wrote ${filePath}`);
}

await browser.close();
