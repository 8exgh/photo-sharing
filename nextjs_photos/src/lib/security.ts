/**
 * Security utilities for input validation and sanitization
 */

/**
 * Sanitize a filename to prevent path traversal attacks
 * Removes any directory traversal sequences and validates the filename
 */
export function sanitizeFilename(filename: string): string | null {
  if (!filename || typeof filename !== 'string') {
    return null;
  }

  // Remove any path separators and parent directory references
  const sanitized = filename
    .split(/[\/\\]/) // Split on forward or back slashes
    .pop() || ''; // Get only the filename part
  
  // Check for directory traversal attempts
  if (
    sanitized.includes('..') ||
    sanitized.includes('./') ||
    sanitized.includes('.\\') ||
    sanitized !== filename // If sanitized doesn't match original, it had path components
  ) {
    return null;
  }

  // Validate filename format (alphanumeric, dots, hyphens, underscores)
  // This regex allows common image filename patterns
  const validFilenameRegex = /^[a-zA-Z0-9._-]+$/;
  if (!validFilenameRegex.test(sanitized)) {
    return null;
  }

  // Check for dangerous double extensions (e.g., image.php.jpg)
  // But allow legitimate ones like image.2200x1170.jpg
  const dangerousExtensions = [
    '.php', '.asp', '.aspx', '.jsp', '.cgi', '.pl', '.py', 
    '.rb', '.sh', '.bat', '.exe', '.cmd', '.com', '.ps1',
    '.js', '.vbs', '.jar', '.app', '.deb', '.rpm'
  ];
  
  const lowerFilename = sanitized.toLowerCase();
  for (const ext of dangerousExtensions) {
    // Check if dangerous extension appears before the final image extension
    if (lowerFilename.includes(ext + '.')) {
      // Remove the dangerous extension
      const parts = sanitized.split('.');
      const safeExtension = parts[parts.length - 1];
      const nameWithoutDangerousExt = sanitized
        .substring(0, sanitized.lastIndexOf(ext + '.'))
        .replace(/\./g, '_'); // Replace remaining dots with underscores
      return `${nameWithoutDangerousExt}.${safeExtension}`;
    }
  }

  return sanitized;
}

/**
 * Validate year parameter (should be a 4-digit number)
 */
export function sanitizeYear(year: string): string | null {
  if (!year || typeof year !== 'string') {
    return null;
  }

  // Must be exactly 4 digits
  if (!/^\d{4}$/.test(year)) {
    return null;
  }

  const yearNum = parseInt(year, 10);
  // Reasonable year range (2000-2100)
  if (yearNum < 2000 || yearNum > 2100) {
    return null;
  }

  return year;
}

/**
 * Validate album name parameter
 * Album names should be URL-safe and not contain path traversal sequences
 */
export function sanitizeAlbumName(album: string): string | null {
  if (!album || typeof album !== 'string') {
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
    return null;
  }

  // Album names can contain letters, numbers, hyphens, underscores, and spaces
  // but we'll replace spaces with hyphens for safety
  const sanitized = album.replace(/\s+/g, '-');
  
  // Validate format (alphanumeric, hyphens, underscores)
  const validAlbumRegex = /^[a-zA-Z0-9_-]+$/;
  if (!validAlbumRegex.test(sanitized)) {
    return null;
  }

  // Limit length to prevent DOS
  if (sanitized.length > 100) {
    return null;
  }

  return sanitized === album ? album : sanitized;
}

/**
 * Validate a complete path array from catch-all routes
 * Returns sanitized path components or null if invalid
 */
export function sanitizePath(pathComponents: string[]): string[] | null {
  if (!pathComponents || !Array.isArray(pathComponents)) {
    return null;
  }

  const sanitized: string[] = [];
  
  for (const component of pathComponents) {
    // Check for directory traversal in any component
    if (
      component.includes('..') ||
      component.includes('./') ||
      component.includes('.\\') ||
      component === '.' ||
      component === ''
    ) {
      return null;
    }

    // Remove any forward or back slashes
    const clean = component.replace(/[\/\\]/g, '');
    
    // If cleaning changed the component, it was trying to traverse
    if (clean !== component) {
      return null;
    }

    sanitized.push(clean);
  }

  return sanitized;
}

/**
 * Validate that a file has an allowed image extension
 */
export function isValidImageExtension(filename: string): boolean {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const lowerFilename = filename.toLowerCase();
  
  return allowedExtensions.some(ext => lowerFilename.endsWith(ext));
}