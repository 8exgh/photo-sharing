import { listTenantIds, tenantExists } from './tenants';
import { buildReadModel } from './projection';

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

// The tenant that owns a single-tenant site. Normally the only registered
// tenant. If several exist (data from a multi-tenant past, or an unverified
// registration that slipped in before the mode was switched on), a verified
// tenant outranks an unverified one, then the alphabetically first wins so the
// answer is stable. Null until somebody registers.
export function singleTenantOwner(): string | null {
  if (!isSingleTenantSite()) return null;
  const tenants = listTenantIds().filter(tenantExists).sort();
  if (tenants.length === 0) return null;
  return tenants.find((id) => buildReadModel(id).emailVerified) ?? tenants[0];
}

// Whether /register should accept a brand-new username right now.
export function registrationOpen(): boolean {
  return !isSingleTenantSite() || singleTenantOwner() === null;
}
