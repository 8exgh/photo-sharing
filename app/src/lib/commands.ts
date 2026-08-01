import { randomUUID } from 'crypto';
import { join } from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { getDb, appendEvent } from './eventstore';
import { buildReadModel } from './projection';
import { log, logError } from './logger';
import type {
  AccessKeyCreated,
  AccessKeyLabeled,
  AccessKeyRevoked,
  AlbumCreated,
  AlbumMetadataUpdated,
  AlbumTextUpdated,
  AlbumReordered,
  AlbumMovedToGroup,
  AlbumUrlRenamed,
  AlbumYearChanged,
  PhotoUploaded,
  PhotoDeleted,
  PhotoTextUpdated,
  PhotoMoved,
  PhotoRotated,
  VideoAdded,
  VideoDeleted,
  VideoMetadataUpdated,
  GroupCreated,
  GroupMetadataUpdated,
  GroupDeleted,
  GroupReordered,
} from './events';

const DATA_DIR = join(process.cwd(), process.env.DATA_DIR || 'data');
const IMAGES_DIR = join(DATA_DIR, 'images');
const THUMBNAILS_DIR = join(DATA_DIR, 'thumbnails');

async function ensureImageDirs() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
}

// --- Access Keys ---

export function createAccessKey(expires?: string, label?: string): string {
  const TAG = 'commands:createAccessKey';
  const db = getDb();

  const key = Math.random().toString(36).substring(2, 15) +
              Math.random().toString(36).substring(2, 15);

  const event: AccessKeyCreated = {
    type: 'access_key_created',
    version: 1,
    key,
    created: new Date().toISOString(),
    expires,
    label: label?.trim() || undefined,
  };

  db.transaction(() => {
    appendEvent(event.type, event.version, event);
  })();

  log(TAG, 'Access key created', { keyPrefix: key.substring(0, 6), hasLabel: !!event.label });
  return key;
}

export function labelAccessKey(key: string, label: string): boolean {
  const TAG = 'commands:labelAccessKey';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.accessKeys.has(key)) {
      log(TAG, 'Key not found', { keyPrefix: key.substring(0, 6) });
      return false;
    }

    const event: AccessKeyLabeled = {
      type: 'access_key_labeled',
      version: 1,
      key,
      label: label.trim(),
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Access key labeled', { keyPrefix: key.substring(0, 6) });
    return true;
  })();
}

export function revokeAccessKey(key: string): boolean {
  const TAG = 'commands:revokeAccessKey';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.accessKeys.has(key)) {
      log(TAG, 'Key not found', { keyPrefix: key.substring(0, 6) });
      return false;
    }

    const event: AccessKeyRevoked = {
      type: 'access_key_revoked',
      version: 1,
      key,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Access key revoked', { keyPrefix: key.substring(0, 6) });
    return true;
  })();
}

// --- Albums ---

export function createAlbum(params: {
  name: string;
  year: string;
  location?: string;
  description?: string;
  groupId?: string;
  datePrefix?: string;
}): { albumId: string; urlName: string } {
  const TAG = 'commands:createAlbum';
  const db = getDb();

  const albumId = randomUUID();
  const rawName = params.datePrefix ? `${params.datePrefix}-${params.name}` : params.name;
  const urlName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  return db.transaction(() => {
    const model = buildReadModel();

    // Determine display order
    let displayOrder = 0;
    if (params.groupId) {
      const groupAlbums = Array.from(model.albums.values()).filter(
        a => a.groupId === params.groupId && a.year === params.year
      );
      displayOrder = groupAlbums.reduce((max, a) => Math.max(max, a.displayOrder), -1) + 1;
    } else {
      // Unified ordering: consider groups and ungrouped albums in this year
      const yearAlbums = Array.from(model.albums.values()).filter(
        a => a.year === params.year && !a.groupId
      );
      const yearGroups = Array.from(model.groups.values()).filter(
        g => g.year === params.year
      );
      const maxAlbum = yearAlbums.reduce((max, a) => Math.max(max, a.displayOrder), -1);
      const maxGroup = yearGroups.reduce((max, g) => Math.max(max, g.displayOrder), -1);
      displayOrder = Math.max(maxAlbum, maxGroup) + 1;
    }

    const event: AlbumCreated = {
      type: 'album_created',
      version: 1,
      albumId,
      name: params.name,
      urlName,
      year: params.year,
      location: params.location || '',
      description: params.description || '',
      text: '',
      groupId: params.groupId || null,
      displayOrder,
      created: new Date().toISOString(),
    };

    appendEvent(event.type, event.version, event);
    log(TAG, 'Album created', { albumId, name: params.name, urlName });
    return { albumId, urlName };
  })();
}

export function updateAlbumMetadata(albumId: string, updates: {
  name?: string;
  location?: string;
  description?: string;
}): boolean {
  const TAG = 'commands:updateAlbumMetadata';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.albums.has(albumId)) return false;

    const event: AlbumMetadataUpdated = {
      type: 'album_metadata_updated',
      version: 1,
      albumId,
      ...updates,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Album metadata updated', { albumId });
    return true;
  })();
}

export function updateAlbumText(albumId: string, text: string): boolean {
  const TAG = 'commands:updateAlbumText';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.albums.has(albumId)) return false;

    const event: AlbumTextUpdated = {
      type: 'album_text_updated',
      version: 1,
      albumId,
      text,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Album text updated', { albumId });
    return true;
  })();
}

export function reorderAlbum(albumId: string, displayOrder: number): boolean {
  const TAG = 'commands:reorderAlbum';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.albums.has(albumId)) return false;

    const event: AlbumReordered = {
      type: 'album_reordered',
      version: 1,
      albumId,
      displayOrder,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Album reordered', { albumId, displayOrder });
    return true;
  })();
}

export function moveAlbumToGroup(albumId: string, groupId: string | null): boolean {
  const TAG = 'commands:moveAlbumToGroup';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.albums.has(albumId)) return false;

    const event: AlbumMovedToGroup = {
      type: 'album_moved_to_group',
      version: 1,
      albumId,
      groupId,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Album moved to group', { albumId, groupId });
    return true;
  })();
}

export function renameAlbumUrl(albumId: string, newUrlName: string): boolean {
  const TAG = 'commands:renameAlbumUrl';
  const db = getDb();

  if (!/^[a-z0-9_-]+$/.test(newUrlName)) {
    throw new Error('Invalid URL name format');
  }

  return db.transaction(() => {
    const model = buildReadModel();
    const album = model.albums.get(albumId);
    if (!album) return false;

    // Check for conflict
    for (const a of model.albums.values()) {
      if (a.id !== albumId && a.year === album.year && a.urlName === newUrlName) {
        throw new Error(`Album with URL name "${newUrlName}" already exists in ${album.year}`);
      }
    }

    const event: AlbumUrlRenamed = {
      type: 'album_url_renamed',
      version: 1,
      albumId,
      newUrlName,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Album URL renamed', { albumId, newUrlName });
    return true;
  })();
}

export function changeAlbumYear(albumId: string, newYear: string): boolean {
  const TAG = 'commands:changeAlbumYear';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    const album = model.albums.get(albumId);
    if (!album) return false;

    // Check for conflict
    for (const a of model.albums.values()) {
      if (a.id !== albumId && a.year === newYear && a.urlName === album.urlName) {
        throw new Error(`An album with URL "${album.urlName}" already exists in ${newYear}`);
      }
    }

    const event: AlbumYearChanged = {
      type: 'album_year_changed',
      version: 1,
      albumId,
      newYear,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Album year changed', { albumId, newYear });
    return true;
  })();
}

// --- Photos ---

export async function uploadPhoto(
  albumId: string,
  file: File
): Promise<{ photoId: string }> {
  const TAG = 'commands:uploadPhoto';

  await ensureImageDirs();

  const photoId = randomUUID();
  const originalName = file.name;
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');

  // Process image
  const buffer = await file.arrayBuffer();
  const originalBuffer = Buffer.from(buffer);

  const optimizedBuffer = await sharp(originalBuffer)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toBuffer();

  const imageMetadata = await sharp(optimizedBuffer).metadata();
  const fileSize = optimizedBuffer.length;

  // Write files FIRST
  const imagePath = join(IMAGES_DIR, `${photoId}.jpg`);
  const thumbnailPath = join(THUMBNAILS_DIR, `${photoId}.jpg`);

  await fs.writeFile(imagePath, optimizedBuffer);

  await sharp(originalBuffer)
    .resize(300, 300, { fit: 'cover', position: 'entropy' })
    .jpeg({ quality: 75, progressive: true, mozjpeg: true })
    .toFile(thumbnailPath);

  // Then append event
  const event: PhotoUploaded = {
    type: 'photo_uploaded',
    version: 1,
    photoId,
    albumId,
    originalFilename: originalName,
    title: nameWithoutExt,
    width: imageMetadata.width || 0,
    height: imageMetadata.height || 0,
    fileSize,
    uploadDate: new Date().toISOString(),
  };

  appendEvent(event.type, event.version, event);
  log(TAG, 'Photo uploaded', { photoId, albumId, fileSize });
  return { photoId };
}

export function deletePhoto(photoId: string): boolean {
  const TAG = 'commands:deletePhoto';
  const db = getDb();

  const albumId = db.transaction(() => {
    const model = buildReadModel();
    for (const album of model.albums.values()) {
      if (album.photos.has(photoId)) {
        const event: PhotoDeleted = {
          type: 'photo_deleted',
          version: 1,
          photoId,
          albumId: album.id,
        };
        appendEvent(event.type, event.version, event);
        return album.id;
      }
    }
    return null;
  })();

  if (!albumId) return false;

  // Delete files after event (orphan files are harmless)
  const imagePath = join(IMAGES_DIR, `${photoId}.jpg`);
  const thumbnailPath = join(THUMBNAILS_DIR, `${photoId}.jpg`);

  fs.unlink(imagePath).catch(err => {
    if (err.code !== 'ENOENT') logError(TAG, 'Error deleting image file', err);
  });
  fs.unlink(thumbnailPath).catch(err => {
    if (err.code !== 'ENOENT') logError(TAG, 'Error deleting thumbnail file', err);
  });

  log(TAG, 'Photo deleted', { photoId, albumId });
  return true;
}

export function updatePhotoText(photoId: string, text: string): boolean {
  const TAG = 'commands:updatePhotoText';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    for (const album of model.albums.values()) {
      if (album.photos.has(photoId)) {
        const event: PhotoTextUpdated = {
          type: 'photo_text_updated',
          version: 1,
          photoId,
          text,
        };
        appendEvent(event.type, event.version, event);
        log(TAG, 'Photo text updated', { photoId });
        return true;
      }
    }
    return false;
  })();
}

export function movePhoto(photoId: string, toAlbumId: string): boolean {
  const TAG = 'commands:movePhoto';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();

    if (!model.albums.has(toAlbumId)) return false;

    for (const album of model.albums.values()) {
      if (album.photos.has(photoId)) {
        if (album.id === toAlbumId) return false; // Same album

        const event: PhotoMoved = {
          type: 'photo_moved',
          version: 1,
          photoId,
          fromAlbumId: album.id,
          toAlbumId,
        };
        appendEvent(event.type, event.version, event);
        log(TAG, 'Photo moved', { photoId, from: album.id, to: toAlbumId });
        return true;
      }
    }
    return false;
  })();
}

export async function rotatePhoto(photoId: string): Promise<boolean> {
  const TAG = 'commands:rotatePhoto';

  const imagePath = join(IMAGES_DIR, `${photoId}.jpg`);
  const thumbnailPath = join(THUMBNAILS_DIR, `${photoId}.jpg`);

  try {
    await fs.access(imagePath);
  } catch {
    return false;
  }

  // Rotate file
  const photoBuffer = await fs.readFile(imagePath);
  const rotatedBuffer = await sharp(photoBuffer).rotate(90).toBuffer();
  await fs.writeFile(imagePath, rotatedBuffer);

  // Regenerate thumbnail
  try {
    await sharp(rotatedBuffer)
      .resize(300, 300, { fit: 'cover', position: 'entropy' })
      .jpeg({ quality: 75, progressive: true, mozjpeg: true })
      .toFile(thumbnailPath);
  } catch (err) {
    logError(TAG, 'Failed to regenerate thumbnail', err);
  }

  // Append event
  const event: PhotoRotated = {
    type: 'photo_rotated',
    version: 1,
    photoId,
  };
  appendEvent(event.type, event.version, event);
  log(TAG, 'Photo rotated', { photoId });
  return true;
}

// --- Videos ---

export function addVideo(albumId: string, url: string, title: string): { videoId: string } {
  const TAG = 'commands:addVideo';
  const db = getDb();

  const videoId = randomUUID();

  db.transaction(() => {
    const model = buildReadModel();
    if (!model.albums.has(albumId)) {
      throw new Error('Album not found');
    }

    const event: VideoAdded = {
      type: 'video_added',
      version: 1,
      videoId,
      albumId,
      url,
      title,
      addedDate: new Date().toISOString(),
    };
    appendEvent(event.type, event.version, event);
  })();

  log(TAG, 'Video added', { videoId, albumId, title });
  return { videoId };
}

export function deleteVideo(videoId: string): boolean {
  const TAG = 'commands:deleteVideo';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    for (const album of model.albums.values()) {
      if (album.videos.has(videoId)) {
        const event: VideoDeleted = {
          type: 'video_deleted',
          version: 1,
          videoId,
          albumId: album.id,
        };
        appendEvent(event.type, event.version, event);
        log(TAG, 'Video deleted', { videoId, albumId: album.id });
        return true;
      }
    }
    return false;
  })();
}

export function updateVideoMetadata(videoId: string, updates: {
  title?: string;
  text?: string;
}): boolean {
  const TAG = 'commands:updateVideoMetadata';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    for (const album of model.albums.values()) {
      if (album.videos.has(videoId)) {
        const event: VideoMetadataUpdated = {
          type: 'video_metadata_updated',
          version: 1,
          videoId,
          ...updates,
        };
        appendEvent(event.type, event.version, event);
        log(TAG, 'Video metadata updated', { videoId });
        return true;
      }
    }
    return false;
  })();
}

// --- Groups ---

export function createGroup(params: {
  year: string;
  groupName: string;
  displayName: string;
  description?: string;
}): { groupId: string } {
  const TAG = 'commands:createGroup';
  const db = getDb();

  const groupId = params.groupName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  db.transaction(() => {
    const model = buildReadModel();

    // Determine display order
    const yearAlbums = Array.from(model.albums.values()).filter(
      a => a.year === params.year && !a.groupId
    );
    const yearGroups = Array.from(model.groups.values()).filter(
      g => g.year === params.year
    );
    const maxAlbum = yearAlbums.reduce((max, a) => Math.max(max, a.displayOrder), -1);
    const maxGroup = yearGroups.reduce((max, g) => Math.max(max, g.displayOrder), -1);
    const displayOrder = Math.max(maxAlbum, maxGroup) + 1;

    const event: GroupCreated = {
      type: 'group_created',
      version: 1,
      groupId,
      year: params.year,
      displayName: params.displayName,
      description: params.description || '',
      displayOrder,
      created: new Date().toISOString(),
    };
    appendEvent(event.type, event.version, event);
  })();

  log(TAG, 'Group created', { groupId, displayName: params.displayName });
  return { groupId };
}

export function updateGroup(groupId: string, updates: {
  displayName?: string;
  description?: string;
}): boolean {
  const TAG = 'commands:updateGroup';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.groups.has(groupId)) return false;

    const event: GroupMetadataUpdated = {
      type: 'group_metadata_updated',
      version: 1,
      groupId,
      ...updates,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Group updated', { groupId });
    return true;
  })();
}

export function deleteGroup(groupId: string): boolean {
  const TAG = 'commands:deleteGroup';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.groups.has(groupId)) return false;

    // Check if group has albums
    const groupAlbums = Array.from(model.albums.values()).filter(a => a.groupId === groupId);
    if (groupAlbums.length > 0) {
      throw new Error('Cannot delete group containing albums. Please move or delete albums first.');
    }

    const event: GroupDeleted = {
      type: 'group_deleted',
      version: 1,
      groupId,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Group deleted', { groupId });
    return true;
  })();
}

export function reorderGroup(groupId: string, displayOrder: number): boolean {
  const TAG = 'commands:reorderGroup';
  const db = getDb();

  return db.transaction(() => {
    const model = buildReadModel();
    if (!model.groups.has(groupId)) return false;

    const event: GroupReordered = {
      type: 'group_reordered',
      version: 1,
      groupId,
      displayOrder,
    };
    appendEvent(event.type, event.version, event);
    log(TAG, 'Group reordered', { groupId, displayOrder });
    return true;
  })();
}
