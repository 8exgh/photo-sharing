import { promises as fs } from 'fs';
import { join } from 'path';
import { AlbumMetadata } from '@/types';
import { log, logError } from '@/lib/logger';

// Use environment variable for albums directory, fallback to public/albums for development
const ALBUMS_DIR = join(process.cwd(), process.env.ALBUMS_DIR || 'public/albums');

export function sanitizeAlbumName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function createAlbumDirectory(year: string, albumName: string): Promise<string> {
  const TAG = 'lib/albums:createAlbumDirectory';
  const sanitizedName = sanitizeAlbumName(albumName);
  const albumPath = join(ALBUMS_DIR, year, sanitizedName);
  const thumbnailsPath = join(albumPath, 'thumbnails');

  await fs.mkdir(albumPath, { recursive: true });
  await fs.mkdir(thumbnailsPath, { recursive: true });

  log(TAG, 'Album directory created', { year, albumName, sanitizedName, albumPath });
  return albumPath;
}

export async function saveAlbumMetadata(albumPath: string, metadata: AlbumMetadata): Promise<void> {
  const TAG = 'lib/albums:saveAlbumMetadata';
  const metadataPath = join(albumPath, 'album.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  log(TAG, 'Album metadata saved', { albumPath, name: metadata.name });
}

export async function getAlbumMetadata(albumPath: string): Promise<AlbumMetadata | null> {
  try {
    const metadataPath = join(albumPath, 'album.json');
    const data = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Don't log ENOENT as error - file may not exist for non-album directories
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logError('lib/albums:getAlbumMetadata', 'Error reading album metadata', error);
    }
    return null;
  }
}

export async function getAlbumsByYear(year: string): Promise<{ name: string; path: string; metadata: AlbumMetadata | null; firstPhoto: string | null }[]> {
  try {
    const yearPath = join(ALBUMS_DIR, year);
    const albums = await fs.readdir(yearPath);
    
    const albumsWithMetadata = await Promise.all(
      albums.map(async (albumName) => {
        const albumPath = join(yearPath, albumName);
        const stats = await fs.stat(albumPath);
        
        if (stats.isDirectory()) {
          const metadata = await getAlbumMetadata(albumPath);
          const photos = await getAlbumPhotos(albumPath);
          const firstPhoto = photos.length > 0 ? photos[0] : null;
          
          return {
            name: albumName,
            path: albumPath,
            metadata,
            firstPhoto,
          };
        }
        return null;
      })
    );
    
    return albumsWithMetadata.filter(Boolean) as { name: string; path: string; metadata: AlbumMetadata | null; firstPhoto: string | null }[];
  } catch (error) {
    logError('lib/albums:getAlbumsByYear', 'Error getting albums by year', error);
    return [];
  }
}

export async function getAllYears(): Promise<string[]> {
  try {
    const years = await fs.readdir(ALBUMS_DIR);
    const yearDirs = await Promise.all(
      years.map(async (year) => {
        const yearPath = join(ALBUMS_DIR, year);
        const stats = await fs.stat(yearPath);
        return stats.isDirectory() ? year : null;
      })
    );
    
    return yearDirs.filter(Boolean) as string[];
  } catch (error) {
    logError('lib/albums:getAllYears', 'Error getting all years', error);
    return [];
  }
}

export async function moveAlbumToYear(
  currentPath: string,
  newYear: string,
  albumName: string,
  groupId?: string
): Promise<string> {
  const TAG = 'lib/albums:moveAlbumToYear';
  log(TAG, 'Moving album to year', { currentPath, newYear, albumName, groupId });
  // Extract the album folder name from the current path
  const pathParts = currentPath.split('/');
  const albumFolderName = pathParts[pathParts.length - 1];
  
  // Determine the new path
  let newPath: string;
  if (groupId) {
    // If the album is in a group, maintain that in the new year
    const groupPath = join(ALBUMS_DIR, newYear, groupId);
    await fs.mkdir(groupPath, { recursive: true });
    newPath = join(groupPath, albumFolderName);
  } else {
    // Otherwise, place it directly in the year folder
    const yearPath = join(ALBUMS_DIR, newYear);
    await fs.mkdir(yearPath, { recursive: true });
    newPath = join(yearPath, albumFolderName);
  }
  
  // Check if the target already exists
  try {
    await fs.access(newPath);
    throw new Error(`An album with the same name already exists in ${newYear}`);
  } catch (_error) {
    if ((_error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw _error;
    }
  }
  
  // Move the album directory
  await fs.rename(currentPath, newPath);

  log(TAG, 'Album moved successfully', { currentPath, newPath });
  return newPath;
}

export async function renameAlbumFolder(
  currentPath: string,
  oldName: string,
  newName: string
): Promise<string> {
  const TAG = 'lib/albums:renameAlbumFolder';
  log(TAG, 'Renaming album folder', { currentPath, oldName, newName });
  // Validate the new name (only alphanumeric, hyphens, and underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
    throw new Error('Invalid album URL name format. Only letters, numbers, hyphens, and underscores are allowed.');
  }

  // Don't rename if the name is the same
  if (oldName === newName) {
    return currentPath;
  }

  // Build new path by replacing the last occurrence of oldName with newName
  const pathParts = currentPath.split('/');
  const albumIndex = pathParts.lastIndexOf(oldName);
  if (albumIndex === -1) {
    throw new Error('Album folder name not found in path');
  }
  pathParts[albumIndex] = newName;
  const newPath = pathParts.join('/');

  // Check if target already exists
  try {
    await fs.access(newPath);
    throw new Error(`Album with URL name "${newName}" already exists in this location`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  // Rename the folder
  await fs.rename(currentPath, newPath);

  log(TAG, 'Album folder renamed successfully', { oldName, newName, newPath });
  return newPath;
}

export async function getAlbumPhotos(albumPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(albumPath);
    return files.filter(file => {
      const ext = file.toLowerCase().split('.').pop();
      return ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logError('lib/albums:getAlbumPhotos', 'Error getting album photos', error);
    }
    return [];
  }
}