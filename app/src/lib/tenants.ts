import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), process.env.DATA_DIR || 'data');
export const TENANTS_DIR = join(DATA_DIR, 'tenants');

// Usernames double as tenant directory names and access-key prefixes:
// lowercase letters, digits, and hyphens; 3-32 chars; no leading/trailing
// hyphen. The strict pattern also rules out path traversal.
const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function isValidTenantId(id: unknown): id is string {
  return typeof id === 'string' && TENANT_ID_PATTERN.test(id);
}

export function tenantDir(tenantId: string): string {
  if (!isValidTenantId(tenantId)) {
    throw new Error(`Invalid tenant id: ${String(tenantId)}`);
  }
  return join(TENANTS_DIR, tenantId);
}

export function tenantImagesDir(tenantId: string): string {
  return join(tenantDir(tenantId), 'images');
}

export function tenantThumbnailsDir(tenantId: string): string {
  return join(tenantDir(tenantId), 'thumbnails');
}

export function tenantBrandingDir(tenantId: string): string {
  return join(tenantDir(tenantId), 'branding');
}

export function tenantExists(tenantId: string): boolean {
  return isValidTenantId(tenantId) && existsSync(join(tenantDir(tenantId), 'events.db'));
}

export function listTenantIds(): string[] {
  try {
    return readdirSync(TENANTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isValidTenantId(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

// The non-recursive mkdir is the atomic uniqueness guard for registration:
// it throws EEXIST when the username is already taken.
export function createTenantDir(tenantId: string): void {
  mkdirSync(TENANTS_DIR, { recursive: true });
  mkdirSync(tenantDir(tenantId));
}

// Access keys are issued as "<tenantId>.<random>" so share links identify
// their tenant. Keys created before multi-tenancy have no prefix.
export function parseKeyTenant(key: string): string | null {
  const dot = key.indexOf('.');
  if (dot === -1) return null;
  const prefix = key.slice(0, dot);
  return isValidTenantId(prefix) ? prefix : null;
}
