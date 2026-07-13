#!/bin/bash
# Orion IDE — Install Piston Language Runtimes
# Run this after starting the Piston container to install all 16 language runtimes.
# Usage: ./install-runtimes.sh

PISTON_URL="${PISTON_API_URL:-http://localhost:2000/api/v2}"

echo "=== Orion IDE — Installing Piston Runtimes ==="
echo "Piston URL: $PISTON_URL"
echo ""

PACKAGES=(
  "python:3.10.0"
  "javascript:18.15.0"
  "typescript:5.0.3"
  "java:15.0.2"
  "c:10.2.0"
  "c++:10.2.0"
  "go:1.16.2"
  "rust:1.68.2"
  "php:8.2.3"
  "ruby:3.0.1"
  "kotlin:1.8.20"
  "swift:5.3.3"
  "bash:5.2.0"
  "dart:2.19.6"
  "lua:5.4.4"
  "perl:5.36.0"
)

SUCCESS=0
FAIL=0

for pkg in "${PACKAGES[@]}"; do
  LANG="${pkg%%:*}"
  VER="${pkg##*:}"
  echo -n "  Installing $LANG $VER... "
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$PISTON_URL/packages" \
    -H "Content-Type: application/json" \
    -d "{\"language\":\"$LANG\",\"version\":\"$VER\"}" \
    --max-time 120)
  if [ "$RESPONSE" = "200" ]; then
    echo "OK"
    ((SUCCESS++))
  else
    echo "FAIL (HTTP $RESPONSE)"
    ((FAIL++))
  fi
done

echo ""
echo "=== Done: $SUCCESS installed, $FAIL failed ==="
