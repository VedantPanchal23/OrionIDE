#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Development Mode
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")/.."

echo "Starting Orion IDE in development mode..."
docker compose -f docker-compose.dev.yml up --build
