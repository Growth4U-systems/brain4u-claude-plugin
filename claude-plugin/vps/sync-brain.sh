#!/usr/bin/env bash
set -euo pipefail
# Never reset, discard, delete or merge over local learning work.
docker exec --user hermes brain4u-hermes-spike sh -c '
  set -eu
  cd /opt/brain
  [ "$(git branch --show-current)" = main ] || exit 0
  [ -z "$(git status --porcelain)" ] || exit 0
  git fetch --quiet origin main
  git merge --ff-only --quiet origin/main
'
