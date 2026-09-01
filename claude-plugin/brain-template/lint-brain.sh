#!/usr/bin/env bash
set -Eeuo pipefail

brain_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$brain_root"

for required in CLAUDE.md AGENTS.md INDEX.md gbrain.yml governance/memory-writeback-policy.md wiki/README.md; do
  test -s "$required" || { printf 'Missing required Brain file: %s\n' "$required" >&2; exit 1; }
done

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked_paths="$(git ls-files -- .)"
else
  tracked_paths="$(find . -type f -print)"
fi

if printf '%s\n' "$tracked_paths" | grep -E '(^|/)(\.env($|\.)|raw-context/|inbox/raw/|private-memory/|\.memsearch/)' >/dev/null; then
  printf 'A forbidden raw, private or environment path is tracked.\n' >&2
  exit 1
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  secret_found=false
  git grep -nE '(xox[baprs]-[A-Za-z0-9-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{20,})' -- . ':!lint-brain.sh' >/dev/null && secret_found=true
else
  secret_found=false
  grep -R -nE --exclude='lint-brain.sh' '(xox[baprs]-[A-Za-z0-9-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{20,})' . >/dev/null && secret_found=true
fi

if [[ "$secret_found" == true ]]; then
  printf 'A high-confidence secret pattern was detected.\n' >&2
  exit 1
fi

printf 'Brain4U lint passed.\n'
