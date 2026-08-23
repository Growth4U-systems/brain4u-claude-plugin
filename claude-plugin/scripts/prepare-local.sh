#!/usr/bin/env bash

set -Eeuo pipefail

key_path="${1:-$HOME/.ssh/brain4u_installer_ed25519}"
public_key_path="${key_path}.pub"

if ! command -v ssh-keygen >/dev/null 2>&1; then
  printf '%s\n' '{"ok":false,"error":"ssh-keygen is required"}' >&2
  exit 1
fi

if [[ -e "$public_key_path" && ! -e "$key_path" ]]; then
  printf '%s\n' '{"ok":false,"error":"The Brain4U public key exists but its private key is missing"}' >&2
  exit 1
fi

created=false
public_key_recovered=false
install -d -m 0700 "$(dirname "$key_path")"

if [[ ! -e "$key_path" ]]; then
  ssh-keygen -q -t ed25519 -N '' -C 'brain4u-installer' -f "$key_path"
  created=true
elif [[ ! -e "$public_key_path" ]]; then
  umask 077
  ssh-keygen -y -f "$key_path" >"$public_key_path"
  chmod 0644 "$public_key_path"
  public_key_recovered=true
fi

chmod 0600 "$key_path"
chmod 0644 "$public_key_path"
fingerprint="$(ssh-keygen -lf "$public_key_path" -E sha256 | awk '{print $2}')"

printf '{"ok":true,"created":%s,"public_key_recovered":%s,"private_key":"%s","public_key":"%s","fingerprint":"%s"}\n' \
  "$created" "$public_key_recovered" "$key_path" "$public_key_path" "$fingerprint"
