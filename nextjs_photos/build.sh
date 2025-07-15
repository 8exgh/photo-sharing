#!/bin/bash

# Build script for Next.js Docker image only

echo "Building Itres Next.js Docker image..."

# Build the Docker image
docker build -t nextjs-tik .

echo "Build complete!"