#!/usr/bin/env bash
set -Eeuo pipefail
capture_root="${BRAIN4U_CAPTURE_ROOT:-$HOME/.brain4u/captures}"
install -d -m 0700 "$capture_root"
printf '{"ok":true,"capture_root":"%s","instruction":"Distill through save-session before proposing Brain writeback"}\n' "$capture_root"
