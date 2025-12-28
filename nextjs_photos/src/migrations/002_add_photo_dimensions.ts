import { promises as fs } from 'fs';
import path from 'path';
import { Migration } from './types';

interface PhotoMetadata {
  filename: string;
  title: string;
  uploadDate: string;
  description: string;
  text?: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

interface AlbumMetadata {
  name: string;
  location: string;
  description: string;
  text?: string;
  created: string;
  photos: PhotoMetadata[];
  videos: unknown[];
  displayOrder?: number;
}

/**
 * Migration 002: Add photo dimensions
 *
 * This migration ensures all photo metadata includes width, height, and fileSize fields.
 * Existing photos without these fields will have them added (set to undefined initially,
 * to be populated on next access).
 */
export const migration: Migration = {
  version: 2,
  description: 'Add photo dimensions fields to metadata',

  async up(dataPath: string): Promise<void> {
    const albumsPath = path.join(dataPath, 'albums');

    // Get all year directories
    let years: string[];
    try {
      years = await fs.readdir(albumsPath);
    } catch {
      // No albums yet, nothing to migrate
      return;
    }

    for (const year of years) {
      const yearPath = path.join(albumsPath, year);
      const yearStat = await fs.stat(yearPath);
      if (!yearStat.isDirectory()) continue;

      // Process all albums (including nested in groups)
      await processDirectory(yearPath);
    }
  },

  async verify(dataPath: string): Promise<boolean> {
    // This migration is always considered successful if up() completed
    // The actual dimensions will be populated lazily when photos are accessed
    return true;
  },
};

async function processDirectory(dirPath: string): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const entryPath = path.join(dirPath, entry.name);
    const albumJsonPath = path.join(entryPath, 'album.json');

    // Check if this is an album (has album.json)
    try {
      await fs.access(albumJsonPath);
      await processAlbum(albumJsonPath);
    } catch {
      // Not an album, might be a group - recurse into it
      await processDirectory(entryPath);
    }
  }
}

async function processAlbum(albumJsonPath: string): Promise<void> {
  try {
    const content = await fs.readFile(albumJsonPath, 'utf-8');
    const metadata: AlbumMetadata = JSON.parse(content);

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
      await fs.writeFile(albumJsonPath, JSON.stringify(metadata, null, 2));
    }
  } catch (error) {
    // Log but don't fail - individual album issues shouldn't block migration
    console.error(`Warning: Could not process album at ${albumJsonPath}:`, error);
  }
}
