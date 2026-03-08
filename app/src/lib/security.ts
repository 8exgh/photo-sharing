/**
 * Security utilities for input validation and sanitization
 */
import { log } from '@/lib/logger';

/**
 * Validate year parameter (should be a 4-digit number)
 */
export function sanitizeYear(year: string): string | null {
  const TAG = 'lib/security:sanitizeYear';
  if (!year || typeof year !== 'string') {
    log(TAG, 'Invalid year - empty or not string', { year });
    return null;
  }

  // Must be exactly 4 digits
  if (!/^\d{4}$/.test(year)) {
    log(TAG, 'Invalid year format', { year });
    return null;
  }

  const yearNum = parseInt(year, 10);
  // Reasonable year range (2000-2100)
  if (yearNum < 2000 || yearNum > 2100) {
    log(TAG, 'Year out of range', { year });
    return null;
  }

  return year;
}

/**
 * Validate album name parameter
 * Album names should be URL-safe and not contain path traversal sequences
 */
export function sanitizeAlbumName(album: string): string | null {
  const TAG = 'lib/security:sanitizeAlbumName';
  if (!album || typeof album !== 'string') {
    log(TAG, 'Invalid album - empty or not string', { album });
    return null;
  }

  // Check for directory traversal attempts
  if (
    album.includes('..') ||
    album.includes('/') ||
    album.includes('\\') ||
    album.includes('./') ||
    album.includes('.\\')
  ) {
    log(TAG, 'Path traversal attempt in album name', { album });
    return null;
  }

  // Album names can contain letters, numbers, hyphens, underscores, and spaces
  // but we'll replace spaces with hyphens for safety
  const sanitized = album.replace(/\s+/g, '-');

  // Validate format (alphanumeric, hyphens, underscores)
  const validAlbumRegex = /^[a-zA-Z0-9_-]+$/;
  if (!validAlbumRegex.test(sanitized)) {
    log(TAG, 'Invalid album name format', { album });
    return null;
  }

  // Limit length to prevent DOS
  if (sanitized.length > 100) {
    log(TAG, 'Album name too long', { length: sanitized.length });
    return null;
  }

  return sanitized === album ? album : sanitized;
}
