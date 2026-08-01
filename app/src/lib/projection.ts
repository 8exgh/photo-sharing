import { getAllEvents } from './eventstore';
import { DomainEvent } from './events';

export interface PhotoState {
  id: string;
  albumId: string;
  originalFilename: string;
  title: string;
  text: string;
  width: number;
  height: number;
  fileSize: number;
  uploadDate: string;
}

export interface VideoState {
  id: string;
  albumId: string;
  url: string;
  title: string;
  text: string;
  addedDate: string;
}

export interface AlbumState {
  id: string;
  name: string;
  year: string;
  urlName: string;
  location: string;
  description: string;
  text: string;
  created: string;
  groupId: string | null;
  displayOrder: number;
  photos: Map<string, PhotoState>;
  videos: Map<string, VideoState>;
}

export interface GroupState {
  id: string;
  year: string;
  displayName: string;
  description: string;
  displayOrder: number;
  created: string;
}

export interface ReadModel {
  accessKeys: Map<string, { key: string; created: string; expires?: string; label?: string }>;
  albums: Map<string, AlbumState>;
  groups: Map<string, GroupState>;
}

export function buildReadModel(): ReadModel {
  const events = getAllEvents();

  const model: ReadModel = {
    accessKeys: new Map(),
    albums: new Map(),
    groups: new Map(),
  };

  // Side indices for O(1) lookups
  const photoToAlbum = new Map<string, string>();
  const videoToAlbum = new Map<string, string>();

  for (const stored of events) {
    const event = JSON.parse(stored.payload) as DomainEvent;

    switch (event.type) {
      // --- Access Keys ---
      case 'access_key_created': {
        model.accessKeys.set(event.key, {
          key: event.key,
          created: event.created,
          expires: event.expires,
          label: event.label,
        });
        break;
      }
      case 'access_key_labeled': {
        const ak = model.accessKeys.get(event.key);
        if (ak) ak.label = event.label || undefined;
        break;
      }
      case 'access_key_revoked': {
        model.accessKeys.delete(event.key);
        break;
      }

      // --- Albums ---
      case 'album_created': {
        model.albums.set(event.albumId, {
          id: event.albumId,
          name: event.name,
          year: event.year,
          urlName: event.urlName,
          location: event.location,
          description: event.description,
          text: event.text,
          created: event.created,
          groupId: event.groupId,
          displayOrder: event.displayOrder,
          photos: new Map(),
          videos: new Map(),
        });
        break;
      }
      case 'album_metadata_updated': {
        const album = model.albums.get(event.albumId);
        if (album) {
          if (event.name !== undefined) album.name = event.name;
          if (event.location !== undefined) album.location = event.location;
          if (event.description !== undefined) album.description = event.description;
        }
        break;
      }
      case 'album_text_updated': {
        const album = model.albums.get(event.albumId);
        if (album) album.text = event.text;
        break;
      }
      case 'album_reordered': {
        const album = model.albums.get(event.albumId);
        if (album) album.displayOrder = event.displayOrder;
        break;
      }
      case 'album_moved_to_group': {
        const album = model.albums.get(event.albumId);
        if (album) album.groupId = event.groupId;
        break;
      }
      case 'album_url_renamed': {
        const album = model.albums.get(event.albumId);
        if (album) album.urlName = event.newUrlName;
        break;
      }
      case 'album_year_changed': {
        const album = model.albums.get(event.albumId);
        if (album) album.year = event.newYear;
        break;
      }

      // --- Photos ---
      case 'photo_uploaded': {
        const album = model.albums.get(event.albumId);
        if (album) {
          const photo: PhotoState = {
            id: event.photoId,
            albumId: event.albumId,
            originalFilename: event.originalFilename,
            title: event.title,
            text: '',
            width: event.width,
            height: event.height,
            fileSize: event.fileSize,
            uploadDate: event.uploadDate,
          };
          album.photos.set(event.photoId, photo);
          photoToAlbum.set(event.photoId, event.albumId);
        }
        break;
      }
      case 'photo_deleted': {
        const album = model.albums.get(event.albumId);
        if (album) {
          album.photos.delete(event.photoId);
          photoToAlbum.delete(event.photoId);
        }
        break;
      }
      case 'photo_text_updated': {
        const albumId = photoToAlbum.get(event.photoId);
        if (albumId) {
          const album = model.albums.get(albumId);
          const photo = album?.photos.get(event.photoId);
          if (photo) photo.text = event.text;
        }
        break;
      }
      case 'photo_moved': {
        const fromAlbum = model.albums.get(event.fromAlbumId);
        const toAlbum = model.albums.get(event.toAlbumId);
        if (fromAlbum && toAlbum) {
          const photo = fromAlbum.photos.get(event.photoId);
          if (photo) {
            fromAlbum.photos.delete(event.photoId);
            photo.albumId = event.toAlbumId;
            toAlbum.photos.set(event.photoId, photo);
            photoToAlbum.set(event.photoId, event.toAlbumId);
          }
        }
        break;
      }
      case 'photo_rotated': {
        // No state change — file rotation is a side effect
        break;
      }

      // --- Videos ---
      case 'video_added': {
        const album = model.albums.get(event.albumId);
        if (album) {
          const video: VideoState = {
            id: event.videoId,
            albumId: event.albumId,
            url: event.url,
            title: event.title,
            text: '',
            addedDate: event.addedDate,
          };
          album.videos.set(event.videoId, video);
          videoToAlbum.set(event.videoId, event.albumId);
        }
        break;
      }
      case 'video_deleted': {
        const album = model.albums.get(event.albumId);
        if (album) {
          album.videos.delete(event.videoId);
          videoToAlbum.delete(event.videoId);
        }
        break;
      }
      case 'video_text_updated': {
        const albumId = videoToAlbum.get(event.videoId);
        if (albumId) {
          const album = model.albums.get(albumId);
          const video = album?.videos.get(event.videoId);
          if (video) video.text = event.text;
        }
        break;
      }
      case 'video_metadata_updated': {
        const albumId = videoToAlbum.get(event.videoId);
        if (albumId) {
          const album = model.albums.get(albumId);
          const video = album?.videos.get(event.videoId);
          if (video) {
            if (event.title !== undefined) video.title = event.title;
            if (event.text !== undefined) video.text = event.text;
          }
        }
        break;
      }

      // --- Groups ---
      case 'group_created': {
        model.groups.set(event.groupId, {
          id: event.groupId,
          year: event.year,
          displayName: event.displayName,
          description: event.description,
          displayOrder: event.displayOrder,
          created: event.created,
        });
        break;
      }
      case 'group_metadata_updated': {
        const group = model.groups.get(event.groupId);
        if (group) {
          if (event.displayName !== undefined) group.displayName = event.displayName;
          if (event.description !== undefined) group.description = event.description;
        }
        break;
      }
      case 'group_deleted': {
        model.groups.delete(event.groupId);
        break;
      }
      case 'group_reordered': {
        const group = model.groups.get(event.groupId);
        if (group) group.displayOrder = event.displayOrder;
        break;
      }
    }
  }

  return model;
}
