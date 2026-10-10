import { listTenantIds, tenantExists } from './tenants';

// Deployments whose public base URL is one of these hosts run as a
// single-tenant site: the first account to register claims the whole site and
// registration closes behind it. Every other deployment stays multi-tenant.
export const SINGLE_TENANT_HOSTS = ['tiktastik.ca', 'www.tiktastik.ca'];

export function isSingleTenantSite(baseUrl: string | undefined = process.env.APP_BASE_URL): boolean {
  if (!baseUrl) return false;
  try {
    return SINGLE_TENANT_HOSTS.includes(new URL(baseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

// The tenant that owns a single-tenant site: the only registered tenant, or
// the first one found if data from a multi-tenant past is present. Null until
// somebody registers.
export function singleTenantOwner(): string | null {
  if (!isSingleTenantSite()) return null;
  return listTenantIds().filter(tenantExists).sort()[0] ?? null;
}

// Whether /register should accept a brand-new username right now.
export function registrationOpen(): boolean {
  return !isSingleTenantSite() || singleTenantOwner() === null;
}
