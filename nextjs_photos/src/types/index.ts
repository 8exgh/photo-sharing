export interface AlbumMetadata {
  name: string;
  location: string;
  description: string;
  created: string;
  photos: PhotoMetadata[];
  videos: VideoMetadata[];
}

export interface PhotoMetadata {
  filename: string;
  title: string;
  uploadDate: string;
  description: string;
}

export interface VideoMetadata {
  url: string;
  title: string;
  addedDate: string;
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
}