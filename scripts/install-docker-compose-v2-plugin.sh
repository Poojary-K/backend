#!/usr/bin/env bash
# Install Docker Compose v2 as a CLI plugin (~/.docker/cli-plugins/docker-compose).
# Works with Ubuntu's docker.io package when the official docker-compose-plugin APT pkg is unavailable.
#
# Usage: bash scripts/install-docker-compose-v2-plugin.sh
# Then:  docker compose version
#         docker compose up -d

set -euo pipefail

COMPOSE_VERSION="${COMPOSE_VERSION:-v2.29.7}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  PLUGIN_ARCH="x86_64" ;;
  aarch64) PLUGIN_ARCH="aarch64" ;;
  *)
    echo "Unsupported architecture: $ARCH (try setting COMPOSE_VERSION and installing manually)" >&2
    exit 1
    ;;
esac

DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}"
PLUGIN_DIR="$DOCKER_CONFIG/cli-plugins"
mkdir -p "$PLUGIN_DIR"

URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${PLUGIN_ARCH}"
OUT="$PLUGIN_DIR/docker-compose"

echo "Downloading $URL"
curl -fsSL "$URL" -o "$OUT"
chmod +x "$OUT"

echo "Installed: $OUT"
docker compose version
