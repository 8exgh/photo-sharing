#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVE_DIR="$REPO_ROOT/deploy/production"

BIND="${BIND:-192.168.56.1}"
PORT="${PORT:-8000}"

# 192.168.56.1 only exists on the host once the libvirt private network has been
# brought up by `vagrant up`. Fail fast with a useful message if it's missing.
if ! ip -4 addr show | grep -qE "inet ${BIND//./\\.}/"; then
  echo "ERROR: ${BIND} is not configured on this host."
  echo "       Run 'cd ../vagrant-ovh-ubuntu-24.04 && ./vagrant-up' first to"
  echo "       create the libvirt 192.168.56.0/24 network, then re-run this."
  exit 1
fi

echo "==> Serving ${SERVE_DIR} on http://${BIND}:${PORT}/"
echo "    From inside the VM:"
echo "      curl -fsSL http://${BIND}:${PORT}/bootstrap.sh \\"
echo "        | sudo bash -s -- :80 changeme 192.168.56.1:5000/tik_tycholaz:latest 30"
echo ""
echo "    Ctrl-C to stop."
exec python3 -m http.server "$PORT" --bind "$BIND" --directory "$SERVE_DIR"
