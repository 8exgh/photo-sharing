import { promises as fs } from 'fs';
import path from 'path';
import { Migration } from './types';

/**
 * Migration 001: Initial schema
 *
 * This migration establishes the base schema for existing installations.
 * It ensures required files exist and have valid JSON structure.
 */
export const migration: Migration = {
  version: 1,
  description: 'Initial schema - ensure base files exist',

  async up(dataPath: string): Promise<void> {
    // Ensure access-keys.json exists
    const accessKeysPath = path.join(dataPath, 'access-keys.json');
    try {
      await fs.access(accessKeysPath);
      // Validate it's valid JSON
      const content = await fs.readFile(accessKeysPath, 'utf-8');
      JSON.parse(content);
    } catch {
      // Create empty access keys file
      await fs.writeFile(accessKeysPath, JSON.stringify({ keys: [] }, null, 2));
    }

    // Ensure groups.json exists
    const groupsPath = path.join(dataPath, 'groups.json');
    try {
      await fs.access(groupsPath);
      // Validate it's valid JSON
      const content = await fs.readFile(groupsPath, 'utf-8');
      JSON.parse(content);
    } catch {
      // Create empty groups file
      await fs.writeFile(groupsPath, JSON.stringify({ groups: {} }, null, 2));
    }

    // Ensure albums directory exists
    const albumsPath = path.join(dataPath, 'albums');
    try {
      await fs.access(albumsPath);
    } catch {
      await fs.mkdir(albumsPath, { recursive: true });
    }
  },

  async verify(dataPath: string): Promise<boolean> {
    try {
      // Check access-keys.json
      const accessKeysPath = path.join(dataPath, 'access-keys.json');
      const accessKeysContent = await fs.readFile(accessKeysPath, 'utf-8');
      const accessKeys = JSON.parse(accessKeysContent);
      if (!accessKeys || typeof accessKeys !== 'object') {
        return false;
      }

      // Check groups.json
      const groupsPath = path.join(dataPath, 'groups.json');
      const groupsContent = await fs.readFile(groupsPath, 'utf-8');
      const groups = JSON.parse(groupsContent);
      if (!groups || typeof groups !== 'object') {
        return false;
      }

      // Check albums directory exists
      const albumsPath = path.join(dataPath, 'albums');
      const stat = await fs.stat(albumsPath);
      if (!stat.isDirectory()) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },
};
