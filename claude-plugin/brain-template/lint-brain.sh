#!/usr/bin/env bash
set -Eeuo pipefail

brain_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$brain_root"

for required in CLAUDE.md AGENTS.md INDEX.md gbrain.yml governance/memory-writeback-policy.md wiki/README.md; do
  test -s "$required" || { printf 'Missing required Brain file: %s\n' "$required" >&2; exit 1; }
done

if git ls-files | grep -E '(^|/)(\.env($|\.)|raw-context/|inbox/raw/|private-memory/|\.memsearch/)' >/dev/null; then
  printf 'A forbidden raw, private or environment path is tracked.\n' >&2
  exit 1
fi

if git grep -nE '(xox[baprs]-[A-Za-z0-9-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{20,})' -- ':!lint-brain.sh' >/dev/null; then
  printf 'A high-confidence secret pattern was detected.\n' >&2
  exit 1
fi

printf 'Brain4U lint passed.\n'
