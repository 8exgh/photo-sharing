import { promises as fs } from 'fs';
import { join } from 'path';
import { GroupMetadata, AlbumWithGroup } from '@/types';
import { getAlbumMetadata, getAlbumPhotos } from './albums';
import { log, logError } from '@/lib/logger';

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
  const TAG = 'lib/groups:createGroupDirectory';
  const groupPath = join(ALBUMS_DIR, year, groupId);
  await fs.mkdir(groupPath, { recursive: true });
  log(TAG, 'Group directory created', { year, groupId, groupPath });
  return groupPath;
}

export async function saveGroupMetadata(groupPath: string, metadata: GroupMetadata): Promise<void> {
  const TAG = 'lib/groups:saveGroupMetadata';
  const metadataPath = join(groupPath, 'group.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  log(TAG, 'Group metadata saved', { groupPath, groupId: metadata.id });
}

export async function getGroupMetadata(groupPath: string): Promise<GroupMetadata | null> {
  try {
    const metadataPath = join(groupPath, 'group.json');
    const data = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Don't log ENOENT as error - file may not exist for non-group directories
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logError('lib/groups:getGroupMetadata', 'Error reading group metadata', error);
    }
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
  } catch (error) {
    logError('lib/groups:updateGroupAlbumCount', 'Error updating group album count', error);
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
  } catch (error) {
    logError('lib/groups:getGroupsByYear', 'Error getting groups by year', error);
    return [];
  }
}

export async function getAlbumsWithGroups(year: string): Promise<AlbumWithGroup[]> {
  try {
    // Get unified items with their ordering
    const unifiedItems = await getUnifiedYearItems(year);
    const allAlbums: AlbumWithGroup[] = [];

    // Process items in their unified order
    for (const item of unifiedItems) {
      if (item.type === 'group' && item.albumsInGroup) {
        // Add all albums from this group
        allAlbums.push(...item.albumsInGroup);
      } else if (item.type === 'album' && item.album) {
        // Add the ungrouped album
        allAlbums.push(item.album);
      }
    }

    return allAlbums;
  } catch (error) {
    logError('lib/groups:getAlbumsWithGroups', 'Error getting albums with groups', error);
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
  } catch (error) {
    logError('lib/groups:getAlbumsInGroup', 'Error getting albums in group', error);
    return [];
  }
}

export async function moveAlbumToGroup(albumPath: string, year: string, groupId?: string): Promise<string> {
  const TAG = 'lib/groups:moveAlbumToGroup';
  log(TAG, 'Moving album to group', { albumPath, year, groupId });

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
    log(TAG, 'Album moved successfully', { albumPath, newPath, groupId });
  }

  return newPath;
}

export async function deleteGroup(year: string, groupId: string): Promise<boolean> {
  const TAG = 'lib/groups:deleteGroup';
  try {
    log(TAG, 'Deleting group', { year, groupId });
    const groupPath = join(ALBUMS_DIR, year, groupId);
    const metadata = await getGroupMetadata(groupPath);

    if (!metadata) return false;

    if (metadata.albumCount > 0) {
      throw new Error('Cannot delete group containing albums. Please move or delete albums first.');
    }

    await fs.rm(groupPath, { recursive: true });
    log(TAG, 'Group deleted successfully', { year, groupId });
    return true;
  } catch (error) {
    logError(TAG, 'Error deleting group', error);
    throw error;
  }
}

// Unified item type for mixed ordering
export interface UnifiedYearItem {
  type: 'group' | 'album';
  id: string; // Group ID or album path
  displayOrder?: number;
  group?: GroupMetadata;
  album?: AlbumWithGroup;
  albumsInGroup?: AlbumWithGroup[]; // For groups, their contained albums
}

export async function getUnifiedYearItems(year: string): Promise<UnifiedYearItem[]> {
  try {
    const yearPath = join(ALBUMS_DIR, year);
    const items = await fs.readdir(yearPath);
    const unifiedItems: UnifiedYearItem[] = [];

    // Process each item in the year directory
    for (const itemName of items) {
      const itemPath = join(yearPath, itemName);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        const groupMetadata = await getGroupMetadata(itemPath);

        if (groupMetadata) {
          // It's a group
          const groupAlbums = await getAlbumsInGroup(itemPath, groupMetadata.id);
          unifiedItems.push({
            type: 'group',
            id: groupMetadata.id,
            displayOrder: groupMetadata.displayOrder,
            group: groupMetadata,
            albumsInGroup: groupAlbums
          });
        } else {
          // It's an ungrouped album
          const albumMetadata = await getAlbumMetadata(itemPath);
          if (albumMetadata) {
            const photos = await getAlbumPhotos(itemPath);
            const firstPhoto = photos.length > 0 ? photos[0] : null;
            const album: AlbumWithGroup = {
              name: itemName,
              path: itemPath,
              metadata: albumMetadata,
              firstPhoto,
            };

            unifiedItems.push({
              type: 'album',
              id: itemPath,
              displayOrder: albumMetadata.displayOrder,
              album
            });
          }
        }
      }
    }

    // Sort by unified displayOrder
    unifiedItems.sort((a, b) => {
      if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
      }
      // Fallback: groups before albums
      if (a.type !== b.type) {
        return a.type === 'group' ? -1 : 1;
      }
      // Then alphabetical
      const nameA = a.type === 'group' ? a.group?.displayName : a.album?.metadata?.name;
      const nameB = b.type === 'group' ? b.group?.displayName : b.album?.metadata?.name;
      return (nameA || '').localeCompare(nameB || '');
    });

    return unifiedItems;
  } catch (error) {
    logError('lib/groups:getUnifiedYearItems', 'Error getting unified year items', error);
    return [];
  }
}

export async function createGroup(
  year: string,
  groupName: string,
  displayName: string,
  description: string
): Promise<GroupMetadata> {
  const TAG = 'lib/groups:createGroup';
  log(TAG, 'Creating group', { year, groupName, displayName });
  const groupId = sanitizeGroupId(groupName);
  const groupPath = await createGroupDirectory(year, groupId);

  // Get all unified items to determine displayOrder
  const existingItems = await getUnifiedYearItems(year);
  const maxOrder = existingItems.reduce((max, item) => {
    const order = item.displayOrder ?? -1;
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
  log(TAG, 'Group created successfully', { year, groupId, displayName });
  return metadata;
}