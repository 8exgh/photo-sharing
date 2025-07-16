export interface AlbumMetadata {
  name: string;
  location: string;
  description: string;
  text?: string; // Multi-line album text
  created: string;
  photos: PhotoMetadata[];
  videos: VideoMetadata[];
}

export interface PhotoMetadata {
  filename: string;
  title: string;
  uploadDate: string;
  description: string;
  text?: string; // Multi-line photo text
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
}