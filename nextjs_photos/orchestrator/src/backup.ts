import { promises as fs } from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import * as tar from 'tar';
import { BackupInfo } from './types';

const DATA_PATH = process.env.DATA_PATH || '/data';
const BACKUP_PATH = process.env.BACKUP_PATH || '/backups';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '10', 10);

/**
 * Create a backup of the production or staging data
 */
export async function createBackup(
  type: 'production' | 'staging',
  reason: string = 'manual'
): Promise<BackupInfo> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${type}-${reason}-${timestamp}.tar.gz`;
  const sourcePath = path.join(DATA_PATH, type);
  const backupFilePath = path.join(BACKUP_PATH, filename);

  console.log(`Creating backup: ${filename}`);
  console.log(`Source: ${sourcePath}`);
  console.log(`Destination: ${backupFilePath}`);

  // Ensure backup directory exists
  await fs.mkdir(BACKUP_PATH, { recursive: true });

  // Check source exists
  try {
    await fs.access(sourcePath);
  } catch {
    throw new Error(`Source directory does not exist: ${sourcePath}`);
  }

  // Create tar.gz backup
  await tar.create(
    {
      gzip: true,
      file: backupFilePath,
      cwd: DATA_PATH,
    },
    [type]
  );

  // Verify backup was created
  const stats = await fs.stat(backupFilePath);

  if (stats.size === 0) {
    await fs.unlink(backupFilePath);
    throw new Error('Backup file is empty');
  }

  console.log(`Backup created successfully: ${filename} (${formatBytes(stats.size)})`);

  // Clean up old backups
  await cleanupOldBackups(type);

  return {
    filename,
    path: backupFilePath,
    createdAt: new Date().toISOString(),
    size: stats.size,
    type,
  };
}

/**
 * Verify a backup is valid
 */
export async function verifyBackup(backupPath: string): Promise<boolean> {
  try {
    // Check file exists and has content
    const stats = await fs.stat(backupPath);
    if (stats.size === 0) {
      return false;
    }

    // Try to list contents of the archive
    const files: string[] = [];
    await tar.list({
      file: backupPath,
      onReadEntry: (entry) => {
        files.push(entry.path);
      },
    });

    // Should have at least some files
    if (files.length === 0) {
      console.error('Backup verification failed: no files in archive');
      return false;
    }

    console.log(`Backup verified: ${files.length} files`);
    return true;
  } catch (error) {
    console.error('Backup verification failed:', error);
    return false;
  }
}

/**
 * List available backups
 */
export async function listBackups(): Promise<BackupInfo[]> {
  try {
    await fs.mkdir(BACKUP_PATH, { recursive: true });
    const files = await fs.readdir(BACKUP_PATH);

    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (!file.endsWith('.tar.gz')) continue;

      const filePath = path.join(BACKUP_PATH, file);
      const stats = await fs.stat(filePath);

      // Parse type from filename (production-*.tar.gz or staging-*.tar.gz)
      const type = file.startsWith('production-') ? 'production' : 'staging';

      backups.push({
        filename: file,
        path: filePath,
        createdAt: stats.mtime.toISOString(),
        size: stats.size,
        type,
      });
    }

    // Sort by creation date, newest first
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return backups;
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

/**
 * Delete a backup
 */
export async function deleteBackup(filename: string): Promise<void> {
  const backupPath = path.join(BACKUP_PATH, filename);

  // Security check - ensure we're only deleting from backup dir
  if (!backupPath.startsWith(BACKUP_PATH)) {
    throw new Error('Invalid backup path');
  }

  await fs.unlink(backupPath);
  console.log(`Deleted backup: ${filename}`);
}

/**
 * Restore from a backup
 */
export async function restoreBackup(
  filename: string,
  target: 'production' | 'staging'
): Promise<void> {
  const backupPath = path.join(BACKUP_PATH, filename);
  const targetPath = path.join(DATA_PATH, target);

  console.log(`Restoring backup: ${filename} to ${target}`);

  // Verify backup first
  const isValid = await verifyBackup(backupPath);
  if (!isValid) {
    throw new Error('Backup verification failed');
  }

  // Clear target directory
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(targetPath, { recursive: true });

  // Extract backup
  await tar.extract({
    file: backupPath,
    cwd: DATA_PATH,
    strip: 1, // Remove the production/ or staging/ prefix
  });

  console.log(`Backup restored successfully to ${target}`);
}

/**
 * Clean up old backups, keeping only the most recent MAX_BACKUPS
 */
async function cleanupOldBackups(type: 'production' | 'staging'): Promise<void> {
  const backups = await listBackups();
  const typeBackups = backups.filter(b => b.type === type);

  if (typeBackups.length <= MAX_BACKUPS) {
    return;
  }

  // Delete oldest backups
  const toDelete = typeBackups.slice(MAX_BACKUPS);

  for (const backup of toDelete) {
    await deleteBackup(backup.filename);
    console.log(`Cleaned up old backup: ${backup.filename}`);
  }
}

/**
 * Copy production data to staging
 */
export async function copyProdToStaging(): Promise<void> {
  const prodPath = path.join(DATA_PATH, 'production');
  const stagingPath = path.join(DATA_PATH, 'staging');

  console.log('Copying production data to staging...');

  // Clear staging
  await fs.rm(stagingPath, { recursive: true, force: true });
  await fs.mkdir(stagingPath, { recursive: true });

  // Copy production to staging
  await copyDir(prodPath, stagingPath);

  // Verify copy
  const prodStats = await getDirStats(prodPath);
  const stagingStats = await getDirStats(stagingPath);

  if (prodStats.fileCount !== stagingStats.fileCount) {
    throw new Error(
      `Copy verification failed: file count mismatch (prod: ${prodStats.fileCount}, staging: ${stagingStats.fileCount})`
    );
  }

  console.log(`Copied ${prodStats.fileCount} files (${formatBytes(prodStats.totalSize)}) to staging`);
}

/**
 * Recursively copy a directory
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Get directory statistics
 */
async function getDirStats(dirPath: string): Promise<{ fileCount: number; totalSize: number }> {
  let fileCount = 0;
  let totalSize = 0;

  async function processDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await processDir(fullPath);
      } else {
        fileCount++;
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }
  }

  await processDir(dirPath);
  return { fileCount, totalSize };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
