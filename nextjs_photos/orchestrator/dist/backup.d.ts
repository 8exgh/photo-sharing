import { BackupInfo } from './types';
/**
 * Create a backup of the production or staging data
 */
export declare function createBackup(type: 'production' | 'staging', reason?: string): Promise<BackupInfo>;
/**
 * Verify a backup is valid
 */
export declare function verifyBackup(backupPath: string): Promise<boolean>;
/**
 * List available backups
 */
export declare function listBackups(): Promise<BackupInfo[]>;
/**
 * Delete a backup
 */
export declare function deleteBackup(filename: string): Promise<void>;
/**
 * Restore from a backup
 */
export declare function restoreBackup(filename: string, target: 'production' | 'staging'): Promise<void>;
/**
 * Copy production data to staging
 */
export declare function copyProdToStaging(): Promise<void>;
//# sourceMappingURL=backup.d.ts.map