#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Production with HTTPS (requires certs)
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "[ERROR] Missing .env — copy .env.example and fill secrets first."
  exit 1
fi

if [ ! -f infrastructure/nginx/certs/fullchain.pem ] || [ ! -f infrastructure/nginx/certs/privkey.pem ]; then
  echo "[ERROR] TLS certs missing under infrastructure/nginx/certs/"
  echo "  See infrastructure/nginx/certs/README.md or use scripts/prod.sh (HTTP)."
  exit 1
fi

echo "Building and starting Orion IDE (HTTPS)..."
docker compose --project-directory . --env-file .env -f infrastructure/docker-compose.prod.yml up --build -d

echo ""
echo "Orion IDE is running at https://localhost"
echo ""
echo "View logs:   docker compose --project-directory . -f infrastructure/docker-compose.prod.yml logs -f"
echo "Stop:        docker compose --project-directory . -f infrastructure/docker-compose.prod.yml down"
