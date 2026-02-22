#!/bin/bash

GITHUB_USERNAME="8exgh"  # Change this
REGISTRY="ghcr.io"

echo "Login to GitHub Container Registry"
echo "You need a Personal Access Token with 'write:packages' permission"
echo "Create one at: https://github.com/settings/tokens"
echo ""
echo -n "Enter your GitHub PAT: "
read -s PAT
echo ""

echo ${PAT} | docker login ${REGISTRY} -u ${GITHUB_USERNAME} --password-stdin

if [ $? -eq 0 ]; then
    echo "✓ Successfully logged in to ${REGISTRY}"
else
    echo "❌ Login failed!"
fi