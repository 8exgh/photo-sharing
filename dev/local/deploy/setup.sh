#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOMAIN="${1:-:80}"
ADMIN_PASSWORD="${2:-}"

# Create .env from template if it doesn't exist
if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example..."
  cp .env.example .env
else
  echo "==> .env already exists, preserving."
fi

# Set DOMAIN
sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env

# Generate SESSION_SECRET if empty
CURRENT_SECRET=$(grep '^SESSION_SECRET=' .env | cut -d'=' -f2-)
if [ -z "$CURRENT_SECRET" ]; then
  echo "==> Generating SESSION_SECRET..."
  SECRET=$(openssl rand -hex 32)
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${SECRET}|" .env
else
  echo "==> SESSION_SECRET already set, preserving."
fi

# Set ADMIN_PASSWORD
CURRENT_ADMIN=$(grep '^ADMIN_PASSWORD=' .env | cut -d'=' -f2-)
if [ -z "$CURRENT_ADMIN" ]; then
  if [ -n "$ADMIN_PASSWORD" ]; then
    sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" .env
  else
    read -rp "Enter admin password: " ADMIN_PASSWORD
    sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" .env
  fi
else
  echo "==> ADMIN_PASSWORD already set, preserving."
fi

# Pull and start services
echo "==> Pulling images and starting services..."
docker compose pull
docker compose up -d

# Summary
echo ""
echo "============================================"
echo "  Local deployment complete!"
echo "============================================"
echo "  http://localhost:8080  (forwarded port)"
echo "  http://192.168.56.10  (private network)"
echo "============================================"
