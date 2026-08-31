#!/usr/bin/env bash

set -Eeuo pipefail

action="${1:-}"

case "$action" in
  init) ;;
  connect-openrouter|connect-hetzner|create-brain|plan|apply|resume|verify) ;;
  *)
    printf 'Usage: installer-engine.sh init [extra options]\n' >&2
    printf '       installer-engine.sh <connect-openrouter|connect-hetzner|create-brain|plan|apply|resume|verify> <config-path> [extra options]\n' >&2
    exit 2
    ;;
esac

if [[ -z "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
  printf 'CLAUDE_PLUGIN_ROOT is required.\n' >&2
  exit 2
fi

packaged_engine="$CLAUDE_PLUGIN_ROOT/engine/bin/brain4u-installer.js"

if [[ -f "$packaged_engine" ]]; then
  engine="$packaged_engine"
else
  printf 'The Brain4U plugin package is incomplete: engine/bin/brain4u-installer.js is missing.\n' >&2
  exit 1
fi

if [[ "$action" == "init" ]]; then
  shift 1
  exec node "$engine" init --json "$@"
fi

config_path="${2:-}"
if [[ -z "$config_path" ]]; then
  printf 'A config path is required.\n' >&2
  exit 2
fi

shift 2
exec node "$engine" "$action" --config "$config_path" --json "$@"
