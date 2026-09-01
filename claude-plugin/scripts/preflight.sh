#!/usr/bin/env bash

set -u

command_status() {
  if command -v "$1" >/dev/null 2>&1; then
    printf 'true'
  else
    printf 'false'
  fi
}

command_version() {
  if command -v "$1" >/dev/null 2>&1; then
    "$@" 2>&1 | head -n 1 | tr -d '\r\n' | sed 's/"/\\"/g'
  else
    printf 'unavailable'
  fi
}

printf '{\n'
printf '  "schema_version": 1,\n'
printf '  "platform": "%s",\n' "$(uname -s 2>/dev/null || printf unknown)"
printf '  "architecture": "%s",\n' "$(uname -m 2>/dev/null || printf unknown)"
printf '  "commands": {\n'
printf '    "claude": %s,\n' "$(command_status claude)"
printf '    "curl": %s,\n' "$(command_status curl)"
printf '    "docker": %s,\n' "$(command_status docker)"
printf '    "gh": %s,\n' "$(command_status gh)"
printf '    "git": %s,\n' "$(command_status git)"
printf '    "node": %s,\n' "$(command_status node)"
printf '    "python3": %s,\n' "$(command_status python3)"
printf '    "ssh": %s,\n' "$(command_status ssh)"
printf '    "ssh_keygen": %s,\n' "$(command_status ssh-keygen)"
printf '    "uv": %s,\n' "$(command_status uv)"
printf '    "uvx": %s\n' "$(command_status uvx)"
printf '  },\n'
printf '  "versions": {\n'
printf '    "node": "%s",\n' "$(command_version node --version)"
printf '    "gh": "%s",\n' "$(command_version gh --version)"
printf '    "python3": "%s",\n' "$(command_version python3 --version)"
printf '    "ssh": "%s"\n' "$(command_version ssh -V)"
printf '  },\n'
printf '  "brain4u_ssh_key": {\n'
printf '    "private_exists": %s,\n' "$(test -f "$HOME/.ssh/brain4u_installer_ed25519" && printf true || printf false)"
printf '    "public_exists": %s\n' "$(test -f "$HOME/.ssh/brain4u_installer_ed25519.pub" && printf true || printf false)"
printf '  }\n'
printf '}\n'
