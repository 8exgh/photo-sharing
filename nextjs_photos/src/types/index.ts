export interface AlbumMetadata {
  name: string;
  location: string;
  description: string;
  text?: string; // Multi-line album text
  created: string;
  photos: PhotoMetadata[];
  videos: VideoMetadata[];
  displayOrder?: number; // For manual sorting in admin
}

export interface PhotoMetadata {
  filename: string;
  title: string;
  uploadDate: string;
  description: string;
  text?: string; // Multi-line photo text
  width?: number; // Image width in pixels
  height?: number; // Image height in pixels
  fileSize?: number; // File size in bytes
}

export interface VideoMetadata {
  url: string;
  title: string;
  addedDate: string;
  text?: string; // Multi-line video text
}

export interface AccessKey {
  key: string;
  created: string;
  expires?: string;
}

export interface SessionData {
  isAuthenticated: boolean;
  isAdmin: boolean;
  accessKey?: string;
  validatedAt?: string; // Timestamp when access key was last validated
}

export interface GroupMetadata {
  id: string;
  displayName: string;
  description: string;
  created: string;
  albumCount: number;
  displayOrder?: number; // For manual sorting in admin
  nestedAlbums?: string[];
}

export interface AlbumWithGroup {
  name: string;
  path: string;
  metadata: AlbumMetadata | null;
  firstPhoto: string | null;
  groupId?: string;
  isNested?: boolean;
}