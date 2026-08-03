#!/bin/sh
# Generate self-signed TLS certs for local/prod bootstrap.
# For real production, replace with Let's Encrypt or your CA certs.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)/certs"
mkdir -p "$DIR"
if [ -f "$DIR/fullchain.pem" ] && [ -f "$DIR/privkey.pem" ]; then
  echo "Certs already exist in $DIR"
  exit 0
fi
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout "$DIR/privkey.pem" \
  -out "$DIR/fullchain.pem" \
  -subj "/CN=orion.local/O=Orion IDE/C=US"
echo "Wrote $DIR/fullchain.pem and $DIR/privkey.pem"
