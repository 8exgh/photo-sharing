import { Release } from './types';

const GITHUB_API = 'https://api.github.com';
const REGISTRY_OWNER = process.env.REGISTRY_OWNER || 'tycholaz';
const REGISTRY_REPO = process.env.REGISTRY_REPO || 'tik-photos';

// Cache releases for 5 minutes
let releasesCache: { data: Release[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch available releases from GitHub
 */
export async function getAvailableReleases(): Promise<Release[]> {
  // Check cache
  if (releasesCache && Date.now() - releasesCache.timestamp < CACHE_TTL) {
    return releasesCache.data;
  }

  try {
    const url = `${GITHUB_API}/repos/${REGISTRY_OWNER}/${REGISTRY_REPO}/releases`;
    console.log(`Fetching releases from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'tik-orchestrator',
        ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GitHubRelease[];

    const releases: Release[] = data
      .filter((r: GitHubRelease) => !r.draft && !r.prerelease)
      .map((r: GitHubRelease) => ({
        version: r.tag_name.replace(/^v/, ''),
        tag: r.tag_name,
        publishedAt: r.published_at,
        releaseNotes: r.body || '',
        digest: '', // Will be populated from GHCR if needed
      }));

    // Update cache
    releasesCache = { data: releases, timestamp: Date.now() };

    return releases;
  } catch (error) {
    console.error('Error fetching releases:', error);

    // Return cached data if available, even if stale
    if (releasesCache) {
      console.log('Returning stale cached releases');
      return releasesCache.data;
    }

    return [];
  }
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
}

/**
 * Get the latest release
 */
export async function getLatestRelease(): Promise<Release | null> {
  const releases = await getAvailableReleases();
  return releases[0] || null;
}

/**
 * Check if a newer version is available
 */
export async function checkForUpdates(currentVersion: string): Promise<{
  updateAvailable: boolean;
  latestVersion: string | null;
  latestRelease: Release | null;
}> {
  const latest = await getLatestRelease();

  if (!latest) {
    return { updateAvailable: false, latestVersion: null, latestRelease: null };
  }

  const currentParts = parseVersion(currentVersion);
  const latestParts = parseVersion(latest.version);

  const updateAvailable = compareVersions(latestParts, currentParts) > 0;

  return {
    updateAvailable,
    latestVersion: latest.version,
    latestRelease: updateAvailable ? latest : null,
  };
}

/**
 * Parse version string into comparable parts
 */
function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, '')
    .split('.')
    .map(p => parseInt(p, 10) || 0);
}

/**
 * Compare two version arrays
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: number[], b: number[]): number {
  const maxLen = Math.max(a.length, b.length);

  for (let i = 0; i < maxLen; i++) {
    const aVal = a[i] || 0;
    const bVal = b[i] || 0;

    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }

  return 0;
}

/**
 * Get release notes for a specific version
 */
export async function getReleaseNotes(version: string): Promise<string | null> {
  const releases = await getAvailableReleases();
  const release = releases.find(r => r.version === version || r.tag === version);
  return release?.releaseNotes || null;
}

/**
 * Clear the releases cache (useful after an upgrade)
 */
export function clearReleasesCache(): void {
  releasesCache = null;
}
