#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Setup Script
# ─────────────────────────────────────────────────────────────────────────────
# Checks prerequisites, copies .env, and installs Piston language runtimes.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "========================================"
echo "  Orion IDE — Setup"
echo "========================================"

# ── Check Docker ──────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "[ERROR] Docker is not installed. Install Docker Desktop first."
  echo "  https://docs.docker.com/get-docker/"
  exit 1
fi
echo "[OK] Docker found: $(docker --version)"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "[ERROR] Docker Compose is not installed."
  exit 1
fi
echo "[OK] Docker Compose found"

# ── Check Node.js ─────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "[WARN] Node.js not found locally. Only needed for local development."
else
  echo "[OK] Node.js found: $(node --version)"
fi

# ── Copy .env ─────────────────────────────────────────────────────────────
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[OK] Created .env from .env.example"
  echo "[ACTION] Edit .env and fill in your API keys before starting."
else
  echo "[OK] .env already exists"
fi

# ── Install npm dependencies (all services) ──────────────────────────────
echo ""
echo "Installing dependencies..."

for dir in shared frontend services/api-gateway services/auth-service services/drive-service services/editor-service services/execution-service services/agent-service services/notification-service; do
  if [ -f "$dir/package.json" ]; then
    echo "  Installing $dir..."
    (cd "$dir" && npm install --silent) || echo "  [WARN] Failed to install $dir"
  fi
done

echo "[OK] Dependencies installed"

# ── Install Piston runtimes ───────────────────────────────────────────────
echo ""
echo "Setting up Piston language runtimes..."
echo "(This requires Piston to be running at http://localhost:2000)"

PISTON_URL="${PISTON_API_URL:-http://localhost:2000}"

LANGUAGES=(
  "python:3.10.0"
  "javascript:18.15.0"
  "typescript:5.0.3"
  "java:15.0.2"
  "c:10.2.0"
  "cpp:10.2.0"
  "csharp:6.12.0"
  "go:1.16.2"
  "rust:1.50.0"
  "php:8.2.3"
  "ruby:3.0.1"
  "kotlin:1.6.20"
  "swift:5.3.3"
  "bash:5.2.0"
  "r:4.1.1"
  "dart:2.19.6"
  "lua:5.4.4"
  "perl:5.36.0"
)

install_runtime() {
  local lang="${1%%:*}"
  local version="${1##*:}"
  echo -n "  Installing $lang $version... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$PISTON_URL/api/v2/packages" \
    -H "Content-Type: application/json" \
    -d "{\"language\":\"$lang\",\"version\":\"$version\"}" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "OK"
  elif [ "$HTTP_CODE" = "000" ]; then
    echo "SKIPPED (Piston not reachable)"
    return 1
  else
    echo "WARN (HTTP $HTTP_CODE)"
  fi
}

PISTON_OK=true
for lang_ver in "${LANGUAGES[@]}"; do
  if ! install_runtime "$lang_ver"; then
    PISTON_OK=false
    break
  fi
done

if [ "$PISTON_OK" = false ]; then
  echo ""
  echo "[INFO] Piston is not running yet. Start it first with:"
  echo "  docker compose -f infrastructure/docker-compose.prod.yml up piston -d"
  echo "  Then re-run: bash scripts/setup.sh"
fi

echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run: bash scripts/dev.sh   (development)"
echo "  3. Run: bash scripts/prod.sh  (production)"
