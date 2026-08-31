#!/usr/bin/env bash

set -Eeuo pipefail

plugin_root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

required_files=(
  "$plugin_root/.claude-plugin/plugin.json"
  "$plugin_root/skills/brain4u-install/SKILL.md"
  "$plugin_root/engine/bin/brain4u-installer.js"
  "$plugin_root/brain-template/.brain4u-template-version"
  "$plugin_root/brain-template/CLAUDE.md"
  "$plugin_root/brain-template/AGENTS.md"
  "$plugin_root/brain-template/gbrain.yml"
  "$plugin_root/brain-template/governance/memory-writeback-policy.md"
  "$plugin_root/brain-template/skills/brain-read/SKILL.md"
  "$plugin_root/brain-template/skills/brain-write/SKILL.md"
  "$plugin_root/vps/bootstrap-docker.sh"
  "$plugin_root/vps/deploy-hermes.sh"
  "$plugin_root/vps/smoke-hermes.sh"
  "$plugin_root/contracts/slack-manifest.json"
  "$plugin_root/contracts/google-scopes.json"
)

for required_file in "${required_files[@]}"; do
  if [[ ! -f "$required_file" ]]; then
    printf 'Missing packaged file: %s\n' "$required_file" >&2
    exit 1
  fi
done

node --test "$plugin_root/engine/test"/*.test.js >/dev/null
bash "$plugin_root/brain-template/lint-brain.sh" >/dev/null

if grep -R -n --exclude='self-test.sh' --fixed-strings '$CLAUDE_PLUGIN_ROOT/../engine' "$plugin_root" >/dev/null; then
  printf 'The package still references an engine outside the plugin.\n' >&2
  exit 1
fi

if grep -R -n -E --exclude='self-test.sh' '/Users/[^/]+|178\.104\.69\.67|83\.43\.57\.229' "$plugin_root" >/dev/null; then
  printf 'The package contains a developer path or live test IP.\n' >&2
  exit 1
fi

printf '%s\n' '{"ok":true,"packaged_engine":true,"tests_passed":true,"external_engine_dependency":false}'
