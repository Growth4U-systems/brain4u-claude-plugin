#!/usr/bin/env bash
set -Eeuo pipefail
brain_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
printf '{"brain_root":"%s","index":"%s"}\n' "$brain_root" "$brain_root/INDEX.md"
