import { buildReadModel, AlbumState, PhotoState, VideoState } from './projection';

// --- Admin Password ---

export function queryAdminPasswordHash(): string | undefined {
  return buildReadModel().adminPasswordHash;
}

// --- Access Keys ---

export function queryAllAccessKeys(): Array<{ key: string; created: string; expires?: string; label?: string }> {
  const model = buildReadModel();
  return Array.from(model.accessKeys.values());
}

export function queryIsValidAccessKey(key: string): boolean {
  const model = buildReadModel();
  const ak = model.accessKeys.get(key);
  if (!ak) return false;
  if (ak.expires && new Date(ak.expires) < new Date()) return false;
  return true;
}

// --- Years ---

export function queryAllYears(): string[] {
  const model = buildReadModel();
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

export function queryAlbumsWithGroupsByYear(year: string): AlbumWithGroupInfo[] {
  const model = buildReadModel();
  const albums: AlbumWithGroupInfo[] = [];

  for (const album of model.albums.values()) {
    if (album.year === year) {
      albums.push(albumStateToInfo(album));
    }
  }

  albums.sort((a, b) => a.displayOrder - b.displayOrder);
  return albums;
}

export function queryAlbumByYearAndUrlName(year: string, urlName: string): AlbumWithGroupInfo | null {
  const model = buildReadModel();

  for (const album of model.albums.values()) {
    if (album.year === year && album.urlName === urlName) {
      return albumStateToInfo(album);
    }
  }
  return null;
}

export function queryAlbumById(albumId: string): AlbumWithGroupInfo | null {
  const model = buildReadModel();
  const album = model.albums.get(albumId);
  if (!album) return null;
  return albumStateToInfo(album);
}

// --- Photos ---

export function queryPhotoById(photoId: string): (PhotoState & { albumUrlName: string; albumYear: string }) | null {
  const model = buildReadModel();
  for (const album of model.albums.values()) {
    const photo = album.photos.get(photoId);
    if (photo) {
      return { ...photo, albumUrlName: album.urlName, albumYear: album.year };
    }
  }
  return null;
}

// --- Videos ---

export function queryVideoById(videoId: string): (VideoState & { albumId: string }) | null {
  const model = buildReadModel();
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

export function queryGroupsByYear(year: string): GroupInfo[] {
  const model = buildReadModel();
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

export function queryGroupByYearAndId(year: string, groupId: string): GroupInfo | null {
  const model = buildReadModel();
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

export function queryUnifiedYearItems(year: string): UnifiedYearItem[] {
  const model = buildReadModel();
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
