import { UpgradeState, UpgradeResult } from './types';
/**
 * Get current upgrade state
 */
export declare function getUpgradeState(): UpgradeState;
/**
 * Reset upgrade state
 */
export declare function resetState(): void;
/**
 * Prepare staging for upgrade
 * 1. Pull new image
 * 2. Copy production data to staging
 * 3. Start staging with new version
 */
export declare function prepareStaging(targetVersion: string): Promise<UpgradeResult>;
/**
 * Upgrade production to match staging version
 * 1. Create backup
 * 2. Stop production
 * 3. Update version
 * 4. Start production
 * 5. Wait for health
 */
export declare function upgradeProduction(): Promise<UpgradeResult>;
/**
 * Get logs from a failed upgrade
 */
export declare function getUpgradeLogs(): Promise<string>;
//# sourceMappingURL=upgrade.d.ts.map