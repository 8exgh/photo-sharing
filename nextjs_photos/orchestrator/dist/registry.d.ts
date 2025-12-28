import { Release } from './types';
/**
 * Fetch available releases from GitHub
 */
export declare function getAvailableReleases(): Promise<Release[]>;
/**
 * Get the latest release
 */
export declare function getLatestRelease(): Promise<Release | null>;
/**
 * Check if a newer version is available
 */
export declare function checkForUpdates(currentVersion: string): Promise<{
    updateAvailable: boolean;
    latestVersion: string | null;
    latestRelease: Release | null;
}>;
/**
 * Get release notes for a specific version
 */
export declare function getReleaseNotes(version: string): Promise<string | null>;
/**
 * Clear the releases cache (useful after an upgrade)
 */
export declare function clearReleasesCache(): void;
//# sourceMappingURL=registry.d.ts.map