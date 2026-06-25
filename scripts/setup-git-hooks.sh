#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
hooks_dir="$repo_root/hooks"

chmod +x "$hooks_dir/prepare-commit-msg"
git -C "$repo_root" config core.hooksPath hooks

echo "Git hooks enabled from $hooks_dir"
