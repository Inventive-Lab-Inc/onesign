#!/usr/bin/env node
/**
 * Prints QA migrations 00124 + 00125 for apply via Supabase SQL editor / MCP.
 * Data fixes from these migrations were already applied live via service role where possible;
 * still apply the SQL so RPCs (revoke_stripe_subscription, cleanup_*, mark_all_*) exist in DB.
 *
 * Usage: node scripts/apply-qa-migrations.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "00124_fix_plan_storage_and_features.sql",
  "00125_qa_hygiene_and_stripe_revoke.sql",
];

console.log(
  JSON.stringify(
    {
      note: "Paste each file into Supabase SQL editor (or MCP apply_migration) in order.",
      files: files.map((file) => ({
        file,
        path: join("packages/database/migrations", file),
        bytes: readFileSync(join(root, "packages/database/migrations", file)).length,
      })),
    },
    null,
    2,
  ),
);
