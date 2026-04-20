#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Single-command VPS bootstrap for tik_tycholaz
#
# Usage:
#   curl -fsSL http://homelab.local/files/bootstrap.sh | sudo bash -s -- <domain> [admin-password] [image] [poll-interval]
#   sudo bash bootstrap.sh <domain> [admin-password] [image] [poll-interval]
#
# Examples:
#   sudo bash bootstrap.sh photos.example.com s3cretpass
#   sudo bash bootstrap.sh :80 changeme                                                            # HTTP-only (Vagrant dev)
#   sudo bash bootstrap.sh :80 changeme 192.168.56.1:5000/tik_tycholaz:latest 30                   # local POC, fast watchtower polling
# ---------------------------------------------------------------------------

DOMAIN="${1:-}"
ADMIN_PASSWORD="${2:-}"
IMAGE="${3:-192.168.56.1:5000/tik_tycholaz:latest}"
POLL_INTERVAL="${4:-300}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: bootstrap.sh <domain> [admin-password] [image] [poll-interval]"
  echo ""
  echo "  domain          Domain name (e.g. photos.example.com) or :80 for HTTP-only"
  echo "  admin-password  Admin password (generated if omitted)"
  echo "  image           Docker image (default: 192.168.56.1:5000/tik_tycholaz:latest)"
  echo "  poll-interval   Watchtower poll interval in seconds (default: 300)"
  exit 1
fi

DEPLOY_DIR="/opt/deploy"

# Generate admin password if not provided
if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD=$(openssl rand -hex 16)
  echo "==> Generated admin password: ${ADMIN_PASSWORD}"
fi

# Detect cookie secure setting from domain
COOKIE_SECURE="true"
if [[ "$DOMAIN" == :* ]]; then
  COOKIE_SECURE="false"
fi

# -------------------------------------------------------------------
# 1. Create deploy directory and write config files
# -------------------------------------------------------------------
echo "==> Creating ${DEPLOY_DIR}..."
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

echo "==> Writing docker-compose.yml..."
cat > docker-compose.yml <<'COMPOSE_EOF'
services:
  app:
    image: ${IMAGE:-192.168.56.1:5000/tik_tycholaz:latest}
    restart: unless-stopped
    volumes:
      - app-data:/app/data
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - COOKIE_SECURE=${COOKIE_SECURE:-true}
      - DATA_DIR=/app/data
      - ALBUMS_DIR=/app/data/albums
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    environment:
      - DOMAIN=${DOMAIN}
    labels:
      - "com.centurylinklabs.watchtower.enable=false"

  watchtower:
    image: containrrr/watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      # containrrr/watchtower's bundled Docker SDK reports API 1.25, which Docker
      # 25+ rejects (min 1.44). Pin the negotiated version so the daemon accepts.
      - DOCKER_API_VERSION=1.44
      - WATCHTOWER_LABEL_ENABLE=true
      - WATCHTOWER_POLL_INTERVAL=${WATCHTOWER_POLL_INTERVAL:-300}
      - WATCHTOWER_CLEANUP=true
    labels:
      - "com.centurylinklabs.watchtower.enable=false"

volumes:
  app-data:
  caddy-data:
  caddy-config:
COMPOSE_EOF

echo "==> Writing Caddyfile..."
cat > Caddyfile <<'CADDY_EOF'
{$DOMAIN} {
    reverse_proxy app:3000
    encode gzip zstd
}
CADDY_EOF

# -------------------------------------------------------------------
# 2. Install Docker CE + Compose plugin (if missing)
# -------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker CE..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --batch --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "==> Docker already installed, skipping."
fi

# -------------------------------------------------------------------
# 3. Create .env
# -------------------------------------------------------------------
if [ ! -f .env ]; then
  echo "==> Creating .env..."
  SESSION_SECRET=$(openssl rand -hex 32)
  cat > .env <<ENV_EOF
DOMAIN=${DOMAIN}
SESSION_SECRET=${SESSION_SECRET}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
COOKIE_SECURE=${COOKIE_SECURE}
IMAGE=${IMAGE}
WATCHTOWER_POLL_INTERVAL=${POLL_INTERVAL}
ENV_EOF
else
  echo "==> .env already exists, preserving."
fi

# -------------------------------------------------------------------
# 4. Pull and start
# -------------------------------------------------------------------
echo "==> Pulling images..."
docker compose pull

echo "==> Starting services..."
docker compose up -d

# -------------------------------------------------------------------
# 5. Summary
# -------------------------------------------------------------------
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "============================================"
echo "  Bootstrap complete!"
echo "============================================"
if [[ "$DOMAIN" == :* ]]; then
  echo "  URL:       http://${SERVER_IP}"
  echo "  Admin:     http://${SERVER_IP}/admin"
else
  echo "  URL:       https://${DOMAIN}"
  echo "  Admin:     https://${DOMAIN}/admin"
  echo ""
  echo "  DNS: Point an A record for ${DOMAIN}"
  echo "        to ${SERVER_IP}"
  echo ""
  echo "  Caddy will auto-obtain TLS once DNS resolves."
fi
echo ""
echo "  Admin password: ${ADMIN_PASSWORD}"
echo "  Deploy dir:     ${DEPLOY_DIR}"
echo "  App data:       docker volume 'deploy_app-data'"
echo "============================================"
