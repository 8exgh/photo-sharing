#!/bin/sh
set -e

echo "=============================================="
echo "TIK PHOTOS - Container Startup"
echo "=============================================="

# Fix permissions for the data directory if it exists
if [ -d "/app/data" ]; then
    echo "[INIT] Fixing data directory permissions..."
    # Create necessary files if they don't exist
    touch /app/data/access-keys.json 2>/dev/null || true
    touch /app/data/groups.json 2>/dev/null || true

    # Try to fix permissions (will fail silently if not root)
    chown -R node:node /app/data 2>/dev/null || true
    chmod -R 755 /app/data 2>/dev/null || true
fi

# Fix permissions for albums directory
if [ -d "/app/public/albums" ]; then
    echo "[INIT] Fixing albums directory permissions..."
    chown -R node:node /app/public/albums 2>/dev/null || true
    chmod -R 755 /app/public/albums 2>/dev/null || true
fi

# Run database migrations
# This will exit with code 1 if migrations fail, preventing app start
echo "[INIT] Running migrations..."
if [ -f "/app/dist/migrations/scripts/run-migrations.js" ]; then
    node /app/dist/migrations/scripts/run-migrations.js
    MIGRATION_EXIT_CODE=$?

    if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
        echo "=============================================="
        echo "FATAL: Migrations failed. Container will not start."
        echo "Please fix the data issues and restart."
        echo "=============================================="
        exit 1
    fi
else
    echo "[INIT] No migrations found (first-time build?), skipping..."
fi

echo "[INIT] Startup complete. Starting application..."
echo "=============================================="

# Execute the main command
exec "$@"