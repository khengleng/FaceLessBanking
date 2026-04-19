#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR/.."

docker compose --env-file .env.example up -d

echo "Local infra started (postgres, redis, kafka)."
