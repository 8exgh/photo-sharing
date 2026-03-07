#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REGISTRY="localhost:5000"
IMAGE_NAME="tik_tycholaz"

# Pre-flight: verify registry is running
if ! curl -sf http://${REGISTRY}/v2/ > /dev/null 2>&1; then
  echo "ERROR: Local registry is not running at ${REGISTRY}"
  echo "Start it first:  cd dev/registry && docker compose up -d"
  exit 1
fi

# Build metadata
GIT_HASH=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_NUMBER="local"
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TIMESTAMP_TAG=$(date +%Y%m%d-%H%M%S)

echo "==> Building ${IMAGE_NAME}..."
echo "    git hash:   ${GIT_HASH:0:12}"
echo "    branch:     ${GIT_BRANCH}"
echo "    build time: ${BUILD_TIME}"

docker build \
  -f "$REPO_ROOT/app/Dockerfile" \
  --build-arg NEXT_PUBLIC_GIT_HASH="$GIT_HASH" \
  --build-arg NEXT_PUBLIC_GIT_BRANCH="$GIT_BRANCH" \
  --build-arg NEXT_PUBLIC_BUILD_NUMBER="$BUILD_NUMBER" \
  --build-arg NEXT_PUBLIC_BUILD_TIME="$BUILD_TIME" \
  -t "${REGISTRY}/${IMAGE_NAME}:latest" \
  -t "${REGISTRY}/${IMAGE_NAME}:${TIMESTAMP_TAG}" \
  "$REPO_ROOT/app"

echo "==> Pushing to ${REGISTRY}..."
docker push "${REGISTRY}/${IMAGE_NAME}:latest"
docker push "${REGISTRY}/${IMAGE_NAME}:${TIMESTAMP_TAG}"

echo ""
echo "==> Done! Pushed:"
echo "    ${REGISTRY}/${IMAGE_NAME}:latest"
echo "    ${REGISTRY}/${IMAGE_NAME}:${TIMESTAMP_TAG}"
echo ""
echo "Watchtower will pick up the new image within 30 seconds."
