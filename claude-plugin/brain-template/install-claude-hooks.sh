#!/usr/bin/env bash
set -Eeuo pipefail
brain_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf 'Brain4U hooks are available at %s/hooks\n' "$brain_root"
printf 'Register these hooks through your Claude Code settings or installer profile.\n'
