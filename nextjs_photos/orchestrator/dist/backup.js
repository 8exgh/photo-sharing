"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBackup = createBackup;
exports.verifyBackup = verifyBackup;
exports.listBackups = listBackups;
exports.deleteBackup = deleteBackup;
exports.restoreBackup = restoreBackup;
exports.copyProdToStaging = copyProdToStaging;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const tar = __importStar(require("tar"));
const DATA_PATH = process.env.DATA_PATH || '/data';
const BACKUP_PATH = process.env.BACKUP_PATH || '/backups';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '10', 10);
/**
 * Create a backup of the production or staging data
 */
async function createBackup(type, reason = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${type}-${reason}-${timestamp}.tar.gz`;
    const sourcePath = path_1.default.join(DATA_PATH, type);
    const backupFilePath = path_1.default.join(BACKUP_PATH, filename);
    console.log(`Creating backup: ${filename}`);
    console.log(`Source: ${sourcePath}`);
    console.log(`Destination: ${backupFilePath}`);
    // Ensure backup directory exists
    await fs_1.promises.mkdir(BACKUP_PATH, { recursive: true });
    // Check source exists
    try {
        await fs_1.promises.access(sourcePath);
    }
    catch {
        throw new Error(`Source directory does not exist: ${sourcePath}`);
    }
    // Create tar.gz backup
    await tar.create({
        gzip: true,
        file: backupFilePath,
        cwd: DATA_PATH,
    }, [type]);
    // Verify backup was created
    const stats = await fs_1.promises.stat(backupFilePath);
    if (stats.size === 0) {
        await fs_1.promises.unlink(backupFilePath);
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
async function verifyBackup(backupPath) {
    try {
        // Check file exists and has content
        const stats = await fs_1.promises.stat(backupPath);
        if (stats.size === 0) {
            return false;
        }
        // Try to list contents of the archive
        const files = [];
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
    }
    catch (error) {
        console.error('Backup verification failed:', error);
        return false;
    }
}
/**
 * List available backups
 */
async function listBackups() {
    try {
        await fs_1.promises.mkdir(BACKUP_PATH, { recursive: true });
        const files = await fs_1.promises.readdir(BACKUP_PATH);
        const backups = [];
        for (const file of files) {
            if (!file.endsWith('.tar.gz'))
                continue;
            const filePath = path_1.default.join(BACKUP_PATH, file);
            const stats = await fs_1.promises.stat(filePath);
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
    }
    catch (error) {
        console.error('Error listing backups:', error);
        return [];
    }
}
/**
 * Delete a backup
 */
async function deleteBackup(filename) {
    const backupPath = path_1.default.join(BACKUP_PATH, filename);
    // Security check - ensure we're only deleting from backup dir
    if (!backupPath.startsWith(BACKUP_PATH)) {
        throw new Error('Invalid backup path');
    }
    await fs_1.promises.unlink(backupPath);
    console.log(`Deleted backup: ${filename}`);
}
/**
 * Restore from a backup
 */
async function restoreBackup(filename, target) {
    const backupPath = path_1.default.join(BACKUP_PATH, filename);
    const targetPath = path_1.default.join(DATA_PATH, target);
    console.log(`Restoring backup: ${filename} to ${target}`);
    // Verify backup first
    const isValid = await verifyBackup(backupPath);
    if (!isValid) {
        throw new Error('Backup verification failed');
    }
    // Clear target directory
    await fs_1.promises.rm(targetPath, { recursive: true, force: true });
    await fs_1.promises.mkdir(targetPath, { recursive: true });
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
async function cleanupOldBackups(type) {
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
async function copyProdToStaging() {
    const prodPath = path_1.default.join(DATA_PATH, 'production');
    const stagingPath = path_1.default.join(DATA_PATH, 'staging');
    console.log('Copying production data to staging...');
    // Clear staging
    await fs_1.promises.rm(stagingPath, { recursive: true, force: true });
    await fs_1.promises.mkdir(stagingPath, { recursive: true });
    // Copy production to staging
    await copyDir(prodPath, stagingPath);
    // Verify copy
    const prodStats = await getDirStats(prodPath);
    const stagingStats = await getDirStats(stagingPath);
    if (prodStats.fileCount !== stagingStats.fileCount) {
        throw new Error(`Copy verification failed: file count mismatch (prod: ${prodStats.fileCount}, staging: ${stagingStats.fileCount})`);
    }
    console.log(`Copied ${prodStats.fileCount} files (${formatBytes(prodStats.totalSize)}) to staging`);
}
/**
 * Recursively copy a directory
 */
async function copyDir(src, dest) {
    await fs_1.promises.mkdir(dest, { recursive: true });
    const entries = await fs_1.promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path_1.default.join(src, entry.name);
        const destPath = path_1.default.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        }
        else {
            await fs_1.promises.copyFile(srcPath, destPath);
        }
    }
}
/**
 * Get directory statistics
 */
async function getDirStats(dirPath) {
    let fileCount = 0;
    let totalSize = 0;
    async function processDir(dir) {
        const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                await processDir(fullPath);
            }
            else {
                fileCount++;
                const stats = await fs_1.promises.stat(fullPath);
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
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
//# sourceMappingURL=backup.js.map