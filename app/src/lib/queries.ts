import { buildReadModel, AlbumState, PhotoState, VideoState } from './projection';
import { listTenantIds, parseKeyTenant, tenantExists } from './tenants';
import type { SessionData } from '@/types';

// --- Admin Password ---

export function queryAdminPasswordHash(tenantId: string): string | undefined {
  return buildReadModel(tenantId).adminPasswordHash;
}

// --- Tenant auth state ---

export function queryTenantAuth(tenantId: string): {
  adminPasswordHash?: string;
  email?: string;
  emailVerified: boolean;
} {
  const model = buildReadModel(tenantId);
  return {
    adminPasswordHash: model.adminPasswordHash,
    email: model.email,
    emailVerified: model.emailVerified,
  };
}

// --- Access Keys ---

export function queryAllAccessKeys(tenantId: string): Array<{ key: string; created: string; expires?: string; label?: string }> {
  const model = buildReadModel(tenantId);
  return Array.from(model.accessKeys.values());
}

export function queryIsValidAccessKey(tenantId: string, key: string): boolean {
  const model = buildReadModel(tenantId);
  const ak = model.accessKeys.get(key);
  if (!ak) return false;
  if (ak.expires && new Date(ak.expires) < new Date()) return false;
  return true;
}

// Resolve which tenant an access key belongs to, returning null when the key
// is not valid anywhere. New keys carry their tenant as a "<tenant>." prefix;
// legacy keys from before multi-tenancy are looked up across all tenants.
export function queryTenantForAccessKey(key: string): string | null {
  const prefixed = parseKeyTenant(key);
  if (prefixed) {
    return tenantExists(prefixed) && queryIsValidAccessKey(prefixed, key) ? prefixed : null;
  }
  for (const tenantId of listTenantIds()) {
    if (tenantExists(tenantId) && queryIsValidAccessKey(tenantId, key)) return tenantId;
  }
  return null;
}

// --- Background processor work ---

export interface PendingVerificationEmail {
  tenantId: string;
  email: string;
  token: string;
}

// Registrations whose verification email has not gone out yet. Each item
// disappears once markVerificationEmailSent records the send (or once the
// tenant verifies through an already-delivered link).
export function queryPendingVerificationEmails(): PendingVerificationEmail[] {
  const pending: PendingVerificationEmail[] = [];
  for (const tenantId of listTenantIds()) {
    if (!tenantExists(tenantId)) continue;
    const model = buildReadModel(tenantId);
    if (
      !model.emailVerified &&
      model.email &&
      model.verificationToken &&
      model.verificationEmailSentToken !== model.verificationToken
    ) {
      pending.push({ tenantId, email: model.email, token: model.verificationToken });
    }
  }
  return pending;
}

// --- Session tenant resolution ---

// Tenant for an authenticated session: admins carry it directly, visitors
// resolve (and implicitly validate) it through their access key.
export function resolveSessionTenant(session: SessionData): string | null {
  if (session.isAdmin) {
    return session.tenantId && tenantExists(session.tenantId) ? session.tenantId : null;
  }
  if (session.accessKey) {
    return queryTenantForAccessKey(session.accessKey);
  }
  return null;
}

// Tenant for an admin session only; null for visitors and stale tenants.
export function resolveAdminTenant(session: SessionData): string | null {
  if (!session.isAdmin || !session.tenantId || !tenantExists(session.tenantId)) return null;
  return session.tenantId;
}

// --- Years ---

export function queryAllYears(tenantId: string): string[] {
  const model = buildReadModel(tenantId);
  const years = new Set<string>();
  for (const album of model.albums.values()) {
    years.add(album.year);
  }
  for (const group of model.groups.values()) {
    years.add(group.year);
  }
  return Array.from(years).sort();
}

// --- Albums ---

export interface AlbumWithGroupInfo {
  albumId: string;
  name: string;
  urlName: string;
  year: string;
  location: string;
  description: string;
  text: string;
  created: string;
  displayOrder: number;
  groupId: string | null;
  firstPhotoId: string | null;
  photoCount: number;
  videoCount: number;
  photos: Array<{
    id: string;
    originalFilename: string;
    title: string;
    text: string;
    width: number;
    height: number;
    fileSize: number;
    uploadDate: string;
  }>;
  videos: Array<{
    id: string;
    url: string;
    title: string;
    text: string;
    addedDate: string;
  }>;
}

function albumStateToInfo(album: AlbumState): AlbumWithGroupInfo {
  const photosArray = Array.from(album.photos.values());
  const videosArray = Array.from(album.videos.values());

  return {
    albumId: album.id,
    name: album.name,
    urlName: album.urlName,
    year: album.year,
    location: album.location,
    description: album.description,
    text: album.text,
    created: album.created,
    displayOrder: album.displayOrder,
    groupId: album.groupId,
    firstPhotoId: photosArray.length > 0 ? photosArray[0].id : null,
    photoCount: photosArray.length,
    videoCount: videosArray.length,
    photos: photosArray.map(p => ({
      id: p.id,
      originalFilename: p.originalFilename,
      title: p.title,
      text: p.text,
      width: p.width,
      height: p.height,
      fileSize: p.fileSize,
      uploadDate: p.uploadDate,
    })),
    videos: videosArray.map(v => ({
      id: v.id,
      url: v.url,
      title: v.title,
      text: v.text,
      addedDate: v.addedDate,
    })),
  };
}

export function queryAlbumsWithGroupsByYear(tenantId: string, year: string): AlbumWithGroupInfo[] {
  const model = buildReadModel(tenantId);
  const albums: AlbumWithGroupInfo[] = [];

  for (const album of model.albums.values()) {
    if (album.year === year) {
      albums.push(albumStateToInfo(album));
    }
  }

  albums.sort((a, b) => a.displayOrder - b.displayOrder);
  return albums;
}

export function queryAlbumByYearAndUrlName(tenantId: string, year: string, urlName: string): AlbumWithGroupInfo | null {
  const model = buildReadModel(tenantId);

  for (const album of model.albums.values()) {
    if (album.year === year && album.urlName === urlName) {
      return albumStateToInfo(album);
    }
  }
  return null;
}

export function queryAlbumById(tenantId: string, albumId: string): AlbumWithGroupInfo | null {
  const model = buildReadModel(tenantId);
  const album = model.albums.get(albumId);
  if (!album) return null;
  return albumStateToInfo(album);
}

// --- Photos ---

export function queryPhotoById(tenantId: string, photoId: string): (PhotoState & { albumUrlName: string; albumYear: string }) | null {
  const model = buildReadModel(tenantId);
  for (const album of model.albums.values()) {
    const photo = album.photos.get(photoId);
    if (photo) {
      return { ...photo, albumUrlName: album.urlName, albumYear: album.year };
    }
  }
  return null;
}

// --- Videos ---

export function queryVideoById(tenantId: string, videoId: string): (VideoState & { albumId: string }) | null {
  const model = buildReadModel(tenantId);
  for (const album of model.albums.values()) {
    const video = album.videos.get(videoId);
    if (video) {
      return { ...video, albumId: album.id };
    }
  }
  return null;
}

// --- Groups ---

export interface GroupInfo {
  id: string;
  year: string;
  displayName: string;
  description: string;
  displayOrder: number;
  created: string;
  albumCount: number;
}

export function queryGroupsByYear(tenantId: string, year: string): GroupInfo[] {
  const model = buildReadModel(tenantId);
  const groups: GroupInfo[] = [];

  for (const group of model.groups.values()) {
    if (group.year === year) {
      const albumCount = Array.from(model.albums.values()).filter(
        a => a.groupId === group.id
      ).length;

      groups.push({
        ...group,
        albumCount,
      });
    }
  }

  groups.sort((a, b) => a.displayOrder - b.displayOrder);
  return groups;
}

export function queryGroupByYearAndId(tenantId: string, year: string, groupId: string): GroupInfo | null {
  const model = buildReadModel(tenantId);
  const group = model.groups.get(groupId);
  if (!group || group.year !== year) return null;

  const albumCount = Array.from(model.albums.values()).filter(
    a => a.groupId === groupId
  ).length;

  return { ...group, albumCount };
}

// --- Unified Items ---

export interface UnifiedYearItem {
  type: 'group' | 'album';
  id: string;
  displayOrder: number;
  group?: GroupInfo;
  album?: AlbumWithGroupInfo;
  albumsInGroup?: AlbumWithGroupInfo[];
}

export function queryUnifiedYearItems(tenantId: string, year: string): UnifiedYearItem[] {
  const model = buildReadModel(tenantId);
  const items: UnifiedYearItem[] = [];

  // Groups
  for (const group of model.groups.values()) {
    if (group.year === year) {
      const groupAlbums = Array.from(model.albums.values())
        .filter(a => a.groupId === group.id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(albumStateToInfo);

      const albumCount = groupAlbums.length;

      items.push({
        type: 'group',
        id: group.id,
        displayOrder: group.displayOrder,
        group: { ...group, albumCount },
        albumsInGroup: groupAlbums,
      });
    }
  }

  // Ungrouped albums
  for (const album of model.albums.values()) {
    if (album.year === year && !album.groupId) {
      items.push({
        type: 'album',
        id: album.id,
        displayOrder: album.displayOrder,
        album: albumStateToInfo(album),
      });
    }
  }

  items.sort((a, b) => a.displayOrder - b.displayOrder);
  return items;
}
