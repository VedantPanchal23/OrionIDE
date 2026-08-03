#!/usr/bin/env bash
# Backup Postgres (Orion users/billing)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"

CONTAINER="${POSTGRES_CONTAINER:-orion-postgres-dev}"
USER_NAME="${POSTGRES_USER:-orion}"
DB_NAME="${POSTGRES_DB:-orion}"
FILE="$OUT_DIR/postgres-$STAMP.sql.gz"

echo "Dumping $DB_NAME from $CONTAINER → $FILE"
docker exec "$CONTAINER" pg_dump -U "$USER_NAME" -d "$DB_NAME" --no-owner --no-acl \
  | gzip > "$FILE"
echo "OK $FILE"
