#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Run All Tests
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
SERVICES=("api-gateway" "auth-service" "drive-service" "editor-service" "execution-service" "agent-service" "notification-service" "terminal-service")

echo "========================================"
echo "  Orion IDE — Test Suite"
echo "========================================"
echo ""

for svc in "${SERVICES[@]}"; do
  DIR="services/$svc"
  if [ -d "$DIR/tests" ] && ls "$DIR/tests"/*.test.js 1> /dev/null 2>&1; then
    echo "--- $svc ---"
    if (cd "$DIR" && npx jest --verbose --no-coverage 2>&1); then
      PASS=$((PASS + 1))
      echo "[PASS] $svc"
    else
      FAIL=$((FAIL + 1))
      echo "[FAIL] $svc"
    fi
    echo ""
  else
    echo "--- $svc --- (no tests found, skipping)"
    echo ""
  fi
done

echo ""
echo "--- Frontend (Vitest) ---"
if [ -d frontend ] && [ -f frontend/package.json ]; then
  if (cd frontend && npm test -- --run 2>&1); then
    PASS=$((PASS + 1))
    echo "[PASS] frontend"
  else
    FAIL=$((FAIL + 1))
    echo "[FAIL] frontend"
  fi
fi

echo ""
echo "========================================"
echo "  Unit Results: $PASS passed, $FAIL failed"
echo "========================================"
echo ""
echo "Live smokes (stack must be up, ORION_ACCESS_TOKEN optional for Drive):"
echo "  node scripts/live-smoke-no-google.mjs"
echo "  \$env:ORION_ACCESS_TOKEN=(node scripts/mint-access-token.mjs --print)"
echo "  node scripts/e2e-full.mjs"
echo "  node scripts/e2e-crud.mjs"
echo "  node scripts/smoke-debug.mjs"
echo "  node scripts/smoke-agent.mjs"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
