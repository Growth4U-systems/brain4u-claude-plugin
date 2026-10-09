#!/usr/bin/env bash

set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  printf 'This script must run as root.\n' >&2
  exit 1
fi

install -d -m 0750 /opt/brain4u/hermes
install -d -m 0700 /opt/brain4u/hermes/data

if [[ ! -s /opt/brain4u/hermes/data/.env ]]; then
  printf 'Missing /opt/brain4u/hermes/data/.env\n' >&2
  exit 1
fi

chmod 0600 /opt/brain4u/hermes/data/.env
chmod 0600 /opt/brain4u/hermes/data/config.yaml
chmod 0644 /opt/brain4u/hermes/compose.yaml

# The official image runs the agent as hermes (UID/GID 10000), not root.
# Bind mounts outside /opt/data are not repaired by its startup hook.
if [[ -d /opt/brain4u/brain/.git ]]; then
  test -f /opt/brain4u/brain/.brain4u-template-version
  test -f /opt/brain4u/secrets/ssh/brain-deploy-key
  chown -R 10000:10000 /opt/brain4u/brain /opt/brain4u/secrets/ssh
  chmod 0700 /opt/brain4u/secrets/ssh
  chmod 0600 /opt/brain4u/secrets/ssh/brain-deploy-key
fi

docker compose -f /opt/brain4u/hermes/compose.yaml config --quiet
docker compose -f /opt/brain4u/hermes/compose.yaml up -d

docker inspect brain4u-hermes-spike --format 'container={{.Name}} status={{.State.Status}} restart_policy={{.HostConfig.RestartPolicy.Name}} image={{.Image}}'

if [[ -d /opt/brain4u/brain/.git ]]; then
  cat >/etc/systemd/system/brain4u-sync.service <<'UNIT'
[Unit]
Description=Fast-forward a clean private Brain checkout
After=docker.service
[Service]
Type=oneshot
ExecStart=/bin/bash /opt/brain4u/sync-brain.sh
UNIT
  cat >/etc/systemd/system/brain4u-sync.timer <<'UNIT'
[Unit]
Description=Check private Brain updates
[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
Persistent=true
[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now brain4u-sync.timer
fi
