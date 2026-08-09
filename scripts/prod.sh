#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Full stack (HTTP, no TLS) — same as scripts/up.sh
# ─────────────────────────────────────────────────────────────────────────────
# Uses root docker-compose.yml (frontend + all services). For HTTPS:
#   scripts/prod-ssl.sh  or  docker compose -f infrastructure/docker-compose.prod.yml up --build -d

set -e
cd "$(dirname "$0")/.."
exec bash scripts/up.sh -d "$@"
