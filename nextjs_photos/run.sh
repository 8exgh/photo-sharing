#!/bin/bash

echo "Starting Itres Next.js container..."
echo "Using DATABASE_URL: ${DATABASE_URL}"

# Stop and remove existing container if it exists
docker stop nextjs-tik 2>/dev/null
docker rm nextjs-tik 2>/dev/null

# Run the container
docker run -d \
    --name nextjs-tik \
    -p 3999:3000 \
    -e NODE_ENV=production \
    nextjs-tik

echo "Container started!"
echo "Access the application at: http://localhost:3003"
echo ""
echo "To view logs: docker logs -f nextjs-tik"
echo "To stop: docker stop nextjs-tik"