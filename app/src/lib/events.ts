// Domain Events — discriminated union of all event types

export interface AdminPasswordSet {
  type: 'admin_password_set';
  version: 1;
  hash: string;
  created: string;
}

export interface AccessKeyCreated {
  type: 'access_key_created';
  version: 1;
  key: string;
  created: string;
  expires?: string;
  label?: string;
}

export interface AccessKeyLabeled {
  type: 'access_key_labeled';
  version: 1;
  key: string;
  label: string;
}

export interface AccessKeyRevoked {
  type: 'access_key_revoked';
  version: 1;
  key: string;
}

export interface AlbumCreated {
  type: 'album_created';
  version: 1;
  albumId: string;
  name: string;
  urlName: string;
  year: string;
  location: string;
  description: string;
  text: string;
  groupId: string | null;
  displayOrder: number;
  created: string;
}

export interface AlbumMetadataUpdated {
  type: 'album_metadata_updated';
  version: 1;
  albumId: string;
  name?: string;
  location?: string;
  description?: string;
}

export interface AlbumTextUpdated {
  type: 'album_text_updated';
  version: 1;
  albumId: string;
  text: string;
}

export interface AlbumReordered {
  type: 'album_reordered';
  version: 1;
  albumId: string;
  displayOrder: number;
}

export interface AlbumMovedToGroup {
  type: 'album_moved_to_group';
  version: 1;
  albumId: string;
  groupId: string | null;
}

export interface AlbumUrlRenamed {
  type: 'album_url_renamed';
  version: 1;
  albumId: string;
  newUrlName: string;
}

export interface AlbumYearChanged {
  type: 'album_year_changed';
  version: 1;
  albumId: string;
  newYear: string;
}

export interface PhotoUploaded {
  type: 'photo_uploaded';
  version: 1;
  photoId: string;
  albumId: string;
  originalFilename: string;
  title: string;
  width: number;
  height: number;
  fileSize: number;
  uploadDate: string;
}

export interface PhotoDeleted {
  type: 'photo_deleted';
  version: 1;
  photoId: string;
  albumId: string;
}

export interface PhotoTextUpdated {
  type: 'photo_text_updated';
  version: 1;
  photoId: string;
  text: string;
}

export interface PhotoMoved {
  type: 'photo_moved';
  version: 1;
  photoId: string;
  fromAlbumId: string;
  toAlbumId: string;
}

export interface PhotoRotated {
  type: 'photo_rotated';
  version: 1;
  photoId: string;
}

export interface VideoAdded {
  type: 'video_added';
  version: 1;
  videoId: string;
  albumId: string;
  url: string;
  title: string;
  addedDate: string;
}

export interface VideoDeleted {
  type: 'video_deleted';
  version: 1;
  videoId: string;
  albumId: string;
}

export interface VideoTextUpdated {
  type: 'video_text_updated';
  version: 1;
  videoId: string;
  text: string;
}

export interface VideoMetadataUpdated {
  type: 'video_metadata_updated';
  version: 1;
  videoId: string;
  title?: string;
  text?: string;
}

export interface GroupCreated {
  type: 'group_created';
  version: 1;
  groupId: string;
  year: string;
  displayName: string;
  description: string;
  displayOrder: number;
  created: string;
}

export interface GroupMetadataUpdated {
  type: 'group_metadata_updated';
  version: 1;
  groupId: string;
  displayName?: string;
  description?: string;
}

export interface GroupDeleted {
  type: 'group_deleted';
  version: 1;
  groupId: string;
}

export interface GroupReordered {
  type: 'group_reordered';
  version: 1;
  groupId: string;
  displayOrder: number;
}

export type DomainEvent =
  | AdminPasswordSet
  | AccessKeyCreated
  | AccessKeyLabeled
  | AccessKeyRevoked
  | AlbumCreated
  | AlbumMetadataUpdated
  | AlbumTextUpdated
  | AlbumReordered
  | AlbumMovedToGroup
  | AlbumUrlRenamed
  | AlbumYearChanged
  | PhotoUploaded
  | PhotoDeleted
  | PhotoTextUpdated
  | PhotoMoved
  | PhotoRotated
  | VideoAdded
  | VideoDeleted
  | VideoTextUpdated
  | VideoMetadataUpdated
  | GroupCreated
  | GroupMetadataUpdated
  | GroupDeleted
  | GroupReordered;
