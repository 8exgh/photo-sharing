import { randomUUID } from 'crypto';
import { join } from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { getDb, initTenantDb, appendEvent } from './eventstore';
import { buildReadModel } from './projection';
import { createTenantDir, tenantExists, tenantImagesDir, tenantThumbnailsDir } from './tenants';
import { log, logError } from './logger';
import type {
  AdminPasswordSet,
  TenantRegistered,
  EmailVerified,
  VerificationEmailSent,
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

async function ensureImageDirs(tenantId: string) {
  await fs.mkdir(tenantImagesDir(tenantId), { recursive: true });
  await fs.mkdir(tenantThumbnailsDir(tenantId), { recursive: true });
}

// --- Tenants ---

// Registers a new tenant: creates its directory (which atomically claims the
// username) and its event store, then records the admin password and the
// pending email verification. The account is inactive until the emailed
// verification link is used. An unverified username can be re-registered —
// that keeps abandoned registrations from squatting names and lets someone
// whose email failed simply try again.
export function registerTenant(
  tenantId: string,
  email: string,
  hash: string,
  verificationToken: string
): 'created' | 'taken' {
  const TAG = 'commands:registerTenant';

  if (tenantExists(tenantId)) {
    const model = buildReadModel(tenantId);
    if (model.emailVerified) {
      log(TAG, 'Username already taken by verified tenant', { tenantId });
      return 'taken';
    }
    log(TAG, 'Re-registering unverified tenant', { tenantId });
  } else {
    try {
      createTenantDir(tenantId);
    } catch (error) {
      // A leftover dir without events.db (crashed registration) is reusable
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    initTenantDb(tenantId);
  }

  const now = new Date().toISOString();
  const passwordEvent: AdminPasswordSet = {
    type: 'admin_password_set',
    version: 1,
    hash,
    created: now,
  };
  appendEvent(tenantId, passwordEvent.type, passwordEvent.version, passwordEvent);

  const registeredEvent: TenantRegistered = {
    type: 'tenant_registered',
    version: 1,
    email,
    verificationToken,
    created: now,
  };
  appendEvent(tenantId, registeredEvent.type, registeredEvent.version, registeredEvent);

  log(TAG, 'Tenant registered, verification pending', { tenantId });
  return 'created';
}

// Records that the verification email for this token went out, completing
// the background processor's work item for it.
export function markVerificationEmailSent(tenantId: string, token: string): boolean {
  const TAG = 'commands:markVerificationEmailSent';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    // The token must still be the current one (a re-registration supersedes
    // it) and not already recorded as sent
    if (model.verificationToken !== token || model.verificationEmailSentToken === token) {
      return false;
    }

    const event: VerificationEmailSent = {
      type: 'verification_email_sent',
      version: 1,
      token,
      sent: new Date().toISOString(),
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Verification email recorded as sent', { tenantId });
    return true;
  })();
}

// Marks the tenant's email as verified, activating the account.
export function verifyTenantEmail(tenantId: string, token: string): boolean {
  const TAG = 'commands:verifyTenantEmail';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (model.emailVerified) return true; // idempotent
    if (!model.verificationToken || model.verificationToken !== token) {
      log(TAG, 'Verification token mismatch', { tenantId });
      return false;
    }

    const event: EmailVerified = {
      type: 'email_verified',
      version: 1,
      verified: new Date().toISOString(),
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Email verified', { tenantId });
    return true;
  })();
}

export function changeAdminPassword(tenantId: string, hash: string): boolean {
  const TAG = 'commands:changeAdminPassword';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (!model.adminPasswordHash) {
      log(TAG, 'No admin password set - nothing to change');
      return false;
    }

    const event: AdminPasswordSet = {
      type: 'admin_password_set',
      version: 1,
      hash,
      created: new Date().toISOString(),
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Admin password changed');
    return true;
  })();
}

// --- Access Keys ---

export function createAccessKey(tenantId: string, expires?: string, label?: string): string {
  const TAG = 'commands:createAccessKey';
  const db = getDb(tenantId);

  // Prefix with the tenant so share links identify which tenant they open
  const key = `${tenantId}.` +
              Math.random().toString(36).substring(2, 15) +
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
    appendEvent(tenantId, event.type, event.version, event);
  })();

  log(TAG, 'Access key created', { keyPrefix: key.substring(0, 6), hasLabel: !!event.label });
  return key;
}

export function labelAccessKey(tenantId: string, key: string, label: string): boolean {
  const TAG = 'commands:labelAccessKey';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
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
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Access key labeled', { keyPrefix: key.substring(0, 6) });
    return true;
  })();
}

export function revokeAccessKey(tenantId: string, key: string): boolean {
  const TAG = 'commands:revokeAccessKey';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (!model.accessKeys.has(key)) {
      log(TAG, 'Key not found', { keyPrefix: key.substring(0, 6) });
      return false;
    }

    const event: AccessKeyRevoked = {
      type: 'access_key_revoked',
      version: 1,
      key,
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Access key revoked', { keyPrefix: key.substring(0, 6) });
    return true;
  })();
}

// --- Albums ---

export function createAlbum(tenantId: string, params: {
  name: string;
  year: string;
  location?: string;
  description?: string;
  groupId?: string;
  datePrefix?: string;
}): { albumId: string; urlName: string } {
  const TAG = 'commands:createAlbum';
  const db = getDb(tenantId);

  const albumId = randomUUID();
  const rawName = params.datePrefix ? `${params.datePrefix}-${params.name}` : params.name;
  const urlName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  return db.transaction(() => {
    const model = buildReadModel(tenantId);

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

    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Album created', { albumId, name: params.name, urlName });
    return { albumId, urlName };
  })();
}

export function updateAlbumMetadata(tenantId: string, albumId: string, updates: {
  name?: string;
  location?: string;
  description?: string;
}): boolean {
  const TAG = 'commands:updateAlbumMetadata';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (!model.albums.has(albumId)) return false;

    const event: AlbumMetadataUpdated = {
      type: 'album_metadata_updated',
      version: 1,
      albumId,
      ...updates,
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Album metadata updated', { albumId });
    return true;
  })();
}

export function updateAlbumText(tenantId: string, albumId: string, text: string): boolean {
  const TAG = 'commands:updateAlbumText';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (!model.albums.has(albumId)) return false;

    const event: AlbumTextUpdated = {
      type: 'album_text_updated',
      version: 1,
      albumId,
      text,
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Album text updated', { albumId });
    return true;
  })();
}

export function reorderAlbum(tenantId: string, albumId: string, displayOrder: number): boolean {
  const TAG = 'commands:reorderAlbum';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (!model.albums.has(albumId)) return false;

    const event: AlbumReordered = {
      type: 'album_reordered',
      version: 1,
      albumId,
      displayOrder,
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Album reordered', { albumId, displayOrder });
    return true;
  })();
}

export function moveAlbumToGroup(tenantId: string, albumId: string, groupId: string | null): boolean {
  const TAG = 'commands:moveAlbumToGroup';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (!model.albums.has(albumId)) return false;

    const event: AlbumMovedToGroup = {
      type: 'album_moved_to_group',
      version: 1,
      albumId,
      groupId,
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Album moved to group', { albumId, groupId });
    return true;
  })();
}

export function renameAlbumUrl(tenantId: string, albumId: string, newUrlName: string): boolean {
  const TAG = 'commands:renameAlbumUrl';
  const db = getDb(tenantId);

  if (!/^[a-z0-9_-]+$/.test(newUrlName)) {
    throw new Error('Invalid URL name format');
  }

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
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
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Album URL renamed', { albumId, newUrlName });
    return true;
  })();
}

export function changeAlbumYear(tenantId: string, albumId: string, newYear: string): boolean {
  const TAG = 'commands:changeAlbumYear';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
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
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Album year changed', { albumId, newYear });
    return true;
  })();
}

// --- Photos ---

export async function uploadPhoto(
  tenantId: string,
  albumId: string,
  file: File
): Promise<{ photoId: string }> {
  const TAG = 'commands:uploadPhoto';

  await ensureImageDirs(tenantId);

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
  const imagePath = join(tenantImagesDir(tenantId), `${photoId}.jpg`);
  const thumbnailPath = join(tenantThumbnailsDir(tenantId), `${photoId}.jpg`);

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

  appendEvent(tenantId, event.type, event.version, event);
  log(TAG, 'Photo uploaded', { photoId, albumId, fileSize });
  return { photoId };
}

export function deletePhoto(tenantId: string, photoId: string): boolean {
  const TAG = 'commands:deletePhoto';
  const db = getDb(tenantId);

  const albumId = db.transaction(() => {
    const model = buildReadModel(tenantId);
    for (const album of model.albums.values()) {
      if (album.photos.has(photoId)) {
        const event: PhotoDeleted = {
          type: 'photo_deleted',
          version: 1,
          photoId,
          albumId: album.id,
        };
        appendEvent(tenantId, event.type, event.version, event);
        return album.id;
      }
    }
    return null;
  })();

  if (!albumId) return false;

  // Delete files after event (orphan files are harmless)
  const imagePath = join(tenantImagesDir(tenantId), `${photoId}.jpg`);
  const thumbnailPath = join(tenantThumbnailsDir(tenantId), `${photoId}.jpg`);

  fs.unlink(imagePath).catch(err => {
    if (err.code !== 'ENOENT') logError(TAG, 'Error deleting image file', err);
  });
  fs.unlink(thumbnailPath).catch(err => {
    if (err.code !== 'ENOENT') logError(TAG, 'Error deleting thumbnail file', err);
  });

  log(TAG, 'Photo deleted', { photoId, albumId });
  return true;
}

export function updatePhotoText(tenantId: string, photoId: string, text: string): boolean {
  const TAG = 'commands:updatePhotoText';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    for (const album of model.albums.values()) {
      if (album.photos.has(photoId)) {
        const event: PhotoTextUpdated = {
          type: 'photo_text_updated',
          version: 1,
          photoId,
          text,
        };
        appendEvent(tenantId, event.type, event.version, event);
        log(TAG, 'Photo text updated', { photoId });
        return true;
      }
    }
    return false;
  })();
}

export function movePhoto(tenantId: string, photoId: string, toAlbumId: string): boolean {
  const TAG = 'commands:movePhoto';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);

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
        appendEvent(tenantId, event.type, event.version, event);
        log(TAG, 'Photo moved', { photoId, from: album.id, to: toAlbumId });
        return true;
      }
    }
    return false;
  })();
}

export async function rotatePhoto(tenantId: string, photoId: string): Promise<boolean> {
  const TAG = 'commands:rotatePhoto';

  const imagePath = join(tenantImagesDir(tenantId), `${photoId}.jpg`);
  const thumbnailPath = join(tenantThumbnailsDir(tenantId), `${photoId}.jpg`);

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
  appendEvent(tenantId, event.type, event.version, event);
  log(TAG, 'Photo rotated', { photoId });
  return true;
}

// --- Videos ---

export function addVideo(tenantId: string, albumId: string, url: string, title: string): { videoId: string } {
  const TAG = 'commands:addVideo';
  const db = getDb(tenantId);

  const videoId = randomUUID();

  db.transaction(() => {
    const model = buildReadModel(tenantId);
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
    appendEvent(tenantId, event.type, event.version, event);
  })();

  log(TAG, 'Video added', { videoId, albumId, title });
  return { videoId };
}

export function deleteVideo(tenantId: string, videoId: string): boolean {
  const TAG = 'commands:deleteVideo';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    for (const album of model.albums.values()) {
      if (album.videos.has(videoId)) {
        const event: VideoDeleted = {
          type: 'video_deleted',
          version: 1,
          videoId,
          albumId: album.id,
        };
        appendEvent(tenantId, event.type, event.version, event);
        log(TAG, 'Video deleted', { videoId, albumId: album.id });
        return true;
      }
    }
    return false;
  })();
}

export function updateVideoMetadata(tenantId: string, videoId: string, updates: {
  title?: string;
  text?: string;
}): boolean {
  const TAG = 'commands:updateVideoMetadata';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    for (const album of model.albums.values()) {
      if (album.videos.has(videoId)) {
        const event: VideoMetadataUpdated = {
          type: 'video_metadata_updated',
          version: 1,
          videoId,
          ...updates,
        };
        appendEvent(tenantId, event.type, event.version, event);
        log(TAG, 'Video metadata updated', { videoId });
        return true;
      }
    }
    return false;
  })();
}

// --- Groups ---

export function createGroup(tenantId: string, params: {
  year: string;
  groupName: string;
  displayName: string;
  description?: string;
}): { groupId: string } {
  const TAG = 'commands:createGroup';
  const db = getDb(tenantId);

  const groupId = params.groupName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  db.transaction(() => {
    const model = buildReadModel(tenantId);

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
    appendEvent(tenantId, event.type, event.version, event);
  })();

  log(TAG, 'Group created', { groupId, displayName: params.displayName });
  return { groupId };
}

export function updateGroup(tenantId: string, groupId: string, updates: {
  displayName?: string;
  description?: string;
}): boolean {
  const TAG = 'commands:updateGroup';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (!model.groups.has(groupId)) return false;

    const event: GroupMetadataUpdated = {
      type: 'group_metadata_updated',
      version: 1,
      groupId,
      ...updates,
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Group updated', { groupId });
    return true;
  })();
}

export function deleteGroup(tenantId: string, groupId: string): boolean {
  const TAG = 'commands:deleteGroup';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
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
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Group deleted', { groupId });
    return true;
  })();
}

export function reorderGroup(tenantId: string, groupId: string, displayOrder: number): boolean {
  const TAG = 'commands:reorderGroup';
  const db = getDb(tenantId);

  return db.transaction(() => {
    const model = buildReadModel(tenantId);
    if (!model.groups.has(groupId)) return false;

    const event: GroupReordered = {
      type: 'group_reordered',
      version: 1,
      groupId,
      displayOrder,
    };
    appendEvent(tenantId, event.type, event.version, event);
    log(TAG, 'Group reordered', { groupId, displayOrder });
    return true;
  })();
}
