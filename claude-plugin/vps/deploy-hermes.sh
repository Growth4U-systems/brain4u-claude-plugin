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

docker compose -f /opt/brain4u/hermes/compose.yaml config --quiet
docker compose -f /opt/brain4u/hermes/compose.yaml up -d

docker inspect brain4u-hermes-spike --format 'container={{.Name}} status={{.State.Status}} restart_policy={{.HostConfig.RestartPolicy.Name}} image={{.Image}}'
