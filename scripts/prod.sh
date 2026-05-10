#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Production Mode
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")/.."

echo "Building and starting Orion IDE in production mode..."
docker compose -f infrastructure/docker-compose.prod.yml build
docker compose -f infrastructure/docker-compose.prod.yml up -d

echo ""
echo "Orion IDE is running at http://localhost"
echo ""
echo "View logs:   docker compose -f infrastructure/docker-compose.prod.yml logs -f"
echo "Stop:        docker compose -f infrastructure/docker-compose.prod.yml down"
