#!/bin/bash

# Configuration
GITHUB_USERNAME="8exgh"
REGISTRY="ghcr.io"
IMAGE_NAME="nextjs-tik"
LOCAL_IMAGE="${IMAGE_NAME}:latest"
REMOTE_IMAGE="${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Pushing to GitHub Container Registry...${NC}"

# Check if local image exists
if ! docker image inspect ${LOCAL_IMAGE} >/dev/null 2>&1; then
    echo "❌ Local image '${LOCAL_IMAGE}' not found!"
    echo "Run ./build.sh first"
    exit 1
fi

# Better way to check if logged in - try to pull/push a small test
echo "Checking registry access..."
if ! docker pull ${REGISTRY}/${GITHUB_USERNAME}/test:latest >/dev/null 2>&1; then
    # This is expected to fail if the test image doesn't exist, but will fail differently if not authenticated
    if docker pull ${REGISTRY}/library/hello-world:latest >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Registry access confirmed${NC}"
    else
        echo -e "${YELLOW}Warning: Could not verify registry access${NC}"
        echo "If push fails, please login with:"
        echo "  ./login.sh"
    fi
fi

# Create timestamp with date and time
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Tag the image for registry
echo "Tagging image..."
docker tag ${LOCAL_IMAGE} ${REMOTE_IMAGE}:latest
docker tag ${LOCAL_IMAGE} ${REMOTE_IMAGE}:${TIMESTAMP}

# Push to registry
echo -e "${BLUE}Pushing ${REMOTE_IMAGE}:latest...${NC}"
docker push ${REMOTE_IMAGE}:latest

if [ $? -eq 0 ]; then
    echo -e "${BLUE}Pushing ${REMOTE_IMAGE}:${TIMESTAMP}...${NC}"
    docker push ${REMOTE_IMAGE}:${TIMESTAMP}

    echo -e "${GREEN}✓ Successfully pushed to registry!${NC}"
    echo "Images available at:"
    echo "  - ${REMOTE_IMAGE}:latest"
    echo "  - ${REMOTE_IMAGE}:${TIMESTAMP}"
else
    echo "❌ Push failed!"
    echo "Try running ./login.sh first"
    exit 1
fi