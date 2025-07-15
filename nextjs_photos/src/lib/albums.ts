import { promises as fs } from 'fs';
import { join } from 'path';
import { AlbumMetadata, PhotoMetadata, VideoMetadata } from '@/types';

const ALBUMS_DIR = join(process.cwd(), 'public', 'albums');

export function sanitizeAlbumName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function createAlbumDirectory(year: string, albumName: string): Promise<string> {
  const sanitizedName = sanitizeAlbumName(albumName);
  const albumPath = join(ALBUMS_DIR, year, sanitizedName);
  const thumbnailsPath = join(albumPath, 'thumbnails');
  
  await fs.mkdir(albumPath, { recursive: true });
  await fs.mkdir(thumbnailsPath, { recursive: true });
  
  return albumPath;
}

export async function saveAlbumMetadata(albumPath: string, metadata: AlbumMetadata): Promise<void> {
  const metadataPath = join(albumPath, 'album.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

export async function getAlbumMetadata(albumPath: string): Promise<AlbumMetadata | null> {
  try {
    const metadataPath = join(albumPath, 'album.json');
    const data = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

export async function getAlbumsByYear(year: string): Promise<{ name: string; path: string; metadata: AlbumMetadata | null }[]> {
  try {
    const yearPath = join(ALBUMS_DIR, year);
    const albums = await fs.readdir(yearPath);
    
    const albumsWithMetadata = await Promise.all(
      albums.map(async (albumName) => {
        const albumPath = join(yearPath, albumName);
        const stats = await fs.stat(albumPath);
        
        if (stats.isDirectory()) {
          const metadata = await getAlbumMetadata(albumPath);
          return {
            name: albumName,
            path: albumPath,
            metadata,
          };
        }
        return null;
      })
    );
    
    return albumsWithMetadata.filter(Boolean) as { name: string; path: string; metadata: AlbumMetadata | null }[];
  } catch (error) {
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
    return [];
  }
}

export async function getAlbumPhotos(albumPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(albumPath);
    return files.filter(file => {
      const ext = file.toLowerCase().split('.').pop();
      return ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
    });
  } catch (error) {
    return [];
  }
}