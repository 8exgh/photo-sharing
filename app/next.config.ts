import type { NextConfig } from "next";
import { execSync } from 'child_process';

// Get git information at build time
function getGitHash() {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch (error) {
    console.warn('Unable to get git hash:', error);
    return 'unknown';
  }
}

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    console.warn('Unable to get git branch:', error);
    return 'unknown';
  }
}

const nextConfig: NextConfig = {
  env: {
    // Git information - available at build time
    NEXT_PUBLIC_GIT_HASH: process.env.NEXT_PUBLIC_GIT_HASH || getGitHash(),
    NEXT_PUBLIC_GIT_BRANCH: process.env.NEXT_PUBLIC_GIT_BRANCH || getGitBranch(),
    
    // Build information - provided by CI/CD
    NEXT_PUBLIC_BUILD_NUMBER: process.env.NEXT_PUBLIC_BUILD_NUMBER || 'local',
    NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
    
    // Data storage paths - configurable for Docker volumes
    DATA_DIR: process.env.DATA_DIR || 'data',
    ALBUMS_DIR: process.env.ALBUMS_DIR || 'public/albums',
  },
  // Allow serving files from data directory
  outputFileTracingIncludes: {
    '/api/images': ['./data/**/*'],
    '/api/thumbnails': ['./data/**/*'],
    '/api/logo': ['./data/**/*', './public/logo.svg'],
  },
};

export default nextConfig;