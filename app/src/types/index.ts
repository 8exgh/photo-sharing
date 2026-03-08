export interface SessionData {
  isAuthenticated: boolean;
  isAdmin: boolean;
  accessKey?: string;
  validatedAt?: string; // Timestamp when access key was last validated
}
