#!/bin/sh
set -e

# Fix permissions for the data directory if it exists
if [ -d "/app/data" ]; then
    # Create necessary files if they don't exist
    touch /app/data/access-keys.json 2>/dev/null || true
    touch /app/data/groups.json 2>/dev/null || true

    # Try to fix permissions (will fail silently if not root)
    chown -R node:node /app/data 2>/dev/null || true
    chmod -R 755 /app/data 2>/dev/null || true
fi

# Execute the main command
exec "$@"