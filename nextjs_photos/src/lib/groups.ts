import { promises as fs } from 'fs';
import { join } from 'path';
import { GroupMetadata, AlbumWithGroup } from '@/types';
import { getAlbumMetadata, getAlbumPhotos } from './albums';

// Use environment variable for albums directory, fallback to public/albums for development
const ALBUMS_DIR = join(process.cwd(), process.env.ALBUMS_DIR || 'public/albums');

export function sanitizeGroupId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function createGroupDirectory(year: string, groupId: string): Promise<string> {
  const groupPath = join(ALBUMS_DIR, year, groupId);
  await fs.mkdir(groupPath, { recursive: true });
  return groupPath;
}

export async function saveGroupMetadata(groupPath: string, metadata: GroupMetadata): Promise<void> {
  const metadataPath = join(groupPath, 'group.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

export async function getGroupMetadata(groupPath: string): Promise<GroupMetadata | null> {
  try {
    const metadataPath = join(groupPath, 'group.json');
    const data = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(data);
  } catch (_error) {
    return null;
  }
}

export async function updateGroupAlbumCount(groupPath: string): Promise<void> {
  const metadata = await getGroupMetadata(groupPath);
  if (!metadata) return;

  try {
    const items = await fs.readdir(groupPath);
    const albumCount = await Promise.all(
      items.map(async (item) => {
        if (item === 'group.json') return false;
        const itemPath = join(groupPath, item);
        const stats = await fs.stat(itemPath);
        return stats.isDirectory();
      })
    );
    
    metadata.albumCount = albumCount.filter(Boolean).length;
    await saveGroupMetadata(groupPath, metadata);
  } catch (_error) {
    console.error('Error updating group album count:', _error);
  }
}

export async function getGroupsByYear(year: string): Promise<GroupMetadata[]> {
  try {
    const yearPath = join(ALBUMS_DIR, year);
    const items = await fs.readdir(yearPath);

    const groups = await Promise.all(
      items.map(async (itemName) => {
        const itemPath = join(yearPath, itemName);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          const metadata = await getGroupMetadata(itemPath);
          if (metadata) {
            return metadata;
          }
        }
        return null;
      })
    );

    const filteredGroups = groups.filter(Boolean) as GroupMetadata[];

    // Sort groups by displayOrder if available, otherwise alphabetically
    filteredGroups.sort((a, b) => {
      if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
      }
      // Fallback to alphabetical by display name
      return a.displayName.localeCompare(b.displayName);
    });

    return filteredGroups;
  } catch (_error) {
    return [];
  }
}

export async function getAlbumsWithGroups(year: string): Promise<AlbumWithGroup[]> {
  try {
    const yearPath = join(ALBUMS_DIR, year);

    // Get sorted groups first
    const groups = await getGroupsByYear(year);
    const groupedAlbumsMap = new Map<string, AlbumWithGroup[]>();

    // Collect albums for each group
    for (const group of groups) {
      const groupPath = join(yearPath, group.id);
      const groupAlbums = await getAlbumsInGroup(groupPath, group.id);
      groupedAlbumsMap.set(group.id, groupAlbums);
    }

    // Get ungrouped albums
    const items = await fs.readdir(yearPath);
    const ungroupedAlbums: AlbumWithGroup[] = [];

    for (const itemName of items) {
      const itemPath = join(yearPath, itemName);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        const groupMetadata = await getGroupMetadata(itemPath);

        if (!groupMetadata) {
          const albumMetadata = await getAlbumMetadata(itemPath);
          if (albumMetadata) {
            const photos = await getAlbumPhotos(itemPath);
            const firstPhoto = photos.length > 0 ? photos[0] : null;

            ungroupedAlbums.push({
              name: itemName,
              path: itemPath,
              metadata: albumMetadata,
              firstPhoto,
            });
          }
        }
      }
    }

    // Sort ungrouped albums by displayOrder if available, otherwise by description (descending)
    ungroupedAlbums.sort((a, b) => {
      if (a.metadata?.displayOrder !== undefined && b.metadata?.displayOrder !== undefined) {
        return a.metadata.displayOrder - b.metadata.displayOrder;
      }
      // Default to description descending if no displayOrder
      const descA = a.metadata?.description || '';
      const descB = b.metadata?.description || '';
      return descB.localeCompare(descA);
    });

    // Combine all albums: grouped albums in group order, then ungrouped
    const allAlbums: AlbumWithGroup[] = [];
    for (const group of groups) {
      const groupAlbums = groupedAlbumsMap.get(group.id) || [];
      allAlbums.push(...groupAlbums);
    }
    allAlbums.push(...ungroupedAlbums);

    return allAlbums;
  } catch (_error) {
    return [];
  }
}

export async function getAlbumsInGroup(groupPath: string, groupId: string): Promise<AlbumWithGroup[]> {
  try {
    const items = await fs.readdir(groupPath);
    const groupMetadata = await getGroupMetadata(groupPath);

    const albums = await Promise.all(
      items.map(async (itemName) => {
        if (itemName === 'group.json') return null;

        const itemPath = join(groupPath, itemName);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          const albumMetadata = await getAlbumMetadata(itemPath);
          if (albumMetadata) {
            const photos = await getAlbumPhotos(itemPath);
            const firstPhoto = photos.length > 0 ? photos[0] : null;

            const isNested = groupMetadata?.nestedAlbums?.includes(itemName) || false;

            return {
              name: itemName,
              path: itemPath,
              metadata: albumMetadata,
              firstPhoto,
              groupId,
              isNested,
            };
          }
        }
        return null;
      })
    );

    const filteredAlbums = albums.filter(Boolean) as AlbumWithGroup[];

    // Sort albums within group by displayOrder if available, otherwise by description (descending)
    filteredAlbums.sort((a, b) => {
      if (a.metadata?.displayOrder !== undefined && b.metadata?.displayOrder !== undefined) {
        return a.metadata.displayOrder - b.metadata.displayOrder;
      }
      // Default to description descending if no displayOrder
      const descA = a.metadata?.description || '';
      const descB = b.metadata?.description || '';
      return descB.localeCompare(descA);
    });

    return filteredAlbums;
  } catch (_error) {
    return [];
  }
}

export async function moveAlbumToGroup(albumPath: string, year: string, groupId?: string): Promise<string> {
  const albumName = albumPath.split('/').pop();
  if (!albumName) throw new Error('Invalid album path');
  
  let newPath: string;
  if (groupId) {
    const groupPath = join(ALBUMS_DIR, year, groupId);
    await fs.mkdir(groupPath, { recursive: true });
    newPath = join(groupPath, albumName);
  } else {
    newPath = join(ALBUMS_DIR, year, albumName);
  }
  
  if (albumPath !== newPath) {
    await fs.rename(albumPath, newPath);
    
    if (groupId) {
      const groupPath = join(ALBUMS_DIR, year, groupId);
      await updateGroupAlbumCount(groupPath);
    }
  }
  
  return newPath;
}

export async function deleteGroup(year: string, groupId: string): Promise<boolean> {
  try {
    const groupPath = join(ALBUMS_DIR, year, groupId);
    const metadata = await getGroupMetadata(groupPath);
    
    if (!metadata) return false;
    
    if (metadata.albumCount > 0) {
      throw new Error('Cannot delete group containing albums. Please move or delete albums first.');
    }
    
    await fs.rm(groupPath, { recursive: true });
    return true;
  } catch (_error) {
    throw _error;
  }
}

export async function createGroup(
  year: string,
  groupName: string,
  displayName: string,
  description: string
): Promise<GroupMetadata> {
  const groupId = sanitizeGroupId(groupName);
  const groupPath = await createGroupDirectory(year, groupId);

  // Get existing groups to determine displayOrder
  const existingGroups = await getGroupsByYear(year);
  const maxOrder = existingGroups.reduce((max, group) => {
    const order = group.displayOrder ?? -1;
    return order > max ? order : max;
  }, -1);

  const metadata: GroupMetadata = {
    id: groupId,
    displayName,
    description,
    created: new Date().toISOString(),
    albumCount: 0,
    displayOrder: maxOrder + 1,
    nestedAlbums: [],
  };

  await saveGroupMetadata(groupPath, metadata);
  return metadata;
}