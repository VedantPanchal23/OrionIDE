#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Start the all-in-one stack (frontend + every service)
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "[ERROR] Missing .env — copy .env.example and fill secrets first."
  echo "  cp .env.example .env"
  exit 1
fi

echo "Building and starting Orion IDE (all-in-one)..."
docker compose up --build "$@"

echo ""
echo "Orion IDE:"
echo "  App:       http://localhost"
echo "  Frontend:  http://localhost:3010"
echo "  API:       http://localhost:3000"
echo ""
echo "Logs:  docker compose logs -f"
echo "Stop:  docker compose down"
