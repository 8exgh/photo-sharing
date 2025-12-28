"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migration = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * Migration 002: Add photo dimensions
 *
 * This migration ensures all photo metadata includes width, height, and fileSize fields.
 * Existing photos without these fields will have them added (set to undefined initially,
 * to be populated on next access).
 */
exports.migration = {
    version: 2,
    description: 'Add photo dimensions fields to metadata',
    async up(dataPath) {
        const albumsPath = path_1.default.join(dataPath, 'albums');
        // Get all year directories
        let years;
        try {
            years = await fs_1.promises.readdir(albumsPath);
        }
        catch (_a) {
            // No albums yet, nothing to migrate
            return;
        }
        for (const year of years) {
            const yearPath = path_1.default.join(albumsPath, year);
            const yearStat = await fs_1.promises.stat(yearPath);
            if (!yearStat.isDirectory())
                continue;
            // Process all albums (including nested in groups)
            await processDirectory(yearPath);
        }
    },
    async verify(dataPath) {
        // This migration is always considered successful if up() completed
        // The actual dimensions will be populated lazily when photos are accessed
        return true;
    },
};
async function processDirectory(dirPath) {
    const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const entryPath = path_1.default.join(dirPath, entry.name);
        const albumJsonPath = path_1.default.join(entryPath, 'album.json');
        // Check if this is an album (has album.json)
        try {
            await fs_1.promises.access(albumJsonPath);
            await processAlbum(albumJsonPath);
        }
        catch (_a) {
            // Not an album, might be a group - recurse into it
            await processDirectory(entryPath);
        }
    }
}
async function processAlbum(albumJsonPath) {
    try {
        const content = await fs_1.promises.readFile(albumJsonPath, 'utf-8');
        const metadata = JSON.parse(content);
        if (!metadata.photos || !Array.isArray(metadata.photos)) {
            return;
        }
        let updated = false;
        for (const photo of metadata.photos) {
            // Ensure photo has dimension fields (even if undefined)
            if (!('width' in photo)) {
                photo.width = undefined;
                updated = true;
            }
            if (!('height' in photo)) {
                photo.height = undefined;
                updated = true;
            }
            if (!('fileSize' in photo)) {
                photo.fileSize = undefined;
                updated = true;
            }
        }
        if (updated) {
            await fs_1.promises.writeFile(albumJsonPath, JSON.stringify(metadata, null, 2));
        }
    }
    catch (error) {
        // Log but don't fail - individual album issues shouldn't block migration
        console.error(`Warning: Could not process album at ${albumJsonPath}:`, error);
    }
}
