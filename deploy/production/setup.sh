#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOMAIN="${1:-}"
ADMIN_PASSWORD="${2:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain> [admin-password]"
  echo "Example: $0 photos.client.com s3cretpass"
  exit 1
fi

echo "==> Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# Install Docker CE + Compose plugin if not present
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker CE..."
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "==> Docker already installed, skipping."
fi

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

# Docker login for GHCR (needed for Watchtower to pull private images)
GHCR_USER=$(grep '^GHCR_USER=' .env | cut -d'=' -f2-)
GHCR_TOKEN=$(grep '^GHCR_TOKEN=' .env | cut -d'=' -f2-)
if [ -n "$GHCR_TOKEN" ] && [ -n "$GHCR_USER" ]; then
  echo "==> Logging into ghcr.io..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
else
  echo "==> GHCR_TOKEN or GHCR_USER not set, skipping docker login."
  echo "   Watchtower won't be able to pull private images."
fi

# Pull and start services
echo "==> Pulling images and starting services..."
docker compose pull
docker compose up -d

# Summary
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo "  Domain:    https://${DOMAIN}"
echo "  Server IP: ${SERVER_IP}"
echo "  Admin URL: https://${DOMAIN}/admin"
echo ""
echo "  DNS: Point an A record for ${DOMAIN}"
echo "        to ${SERVER_IP}"
echo ""
echo "  Caddy will auto-obtain TLS certificates"
echo "  once DNS resolves to this server."
echo "============================================"
