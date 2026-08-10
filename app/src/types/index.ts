export interface SessionData {
  isAuthenticated: boolean;
  isAdmin: boolean;
  // The tenant this session belongs to. Set at login/registration for admins;
  // visitor sessions resolve their tenant from the access key instead.
  tenantId?: string;
  accessKey?: string;
  validatedAt?: string; // Timestamp when access key was last validated
}
