#!/usr/bin/env bash
# Backup Redis RDB (sessions / buffers)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"

CONTAINER="${REDIS_CONTAINER:-orion-redis-dev}"
PASS="${REDIS_PASSWORD:-orion-dev-redis}"
FILE="$OUT_DIR/redis-$STAMP.rdb"

echo "Triggering BGSAVE on $CONTAINER"
docker exec "$CONTAINER" redis-cli -a "$PASS" --no-auth-warning BGSAVE >/dev/null
sleep 2
docker cp "$CONTAINER:/data/dump.rdb" "$FILE"
echo "OK $FILE"
