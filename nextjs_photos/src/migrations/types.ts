/**
 * Migration interface - each migration must implement this
 */
export interface Migration {
  /** Target version this migration upgrades TO */
  version: number;

  /** Human-readable description of what this migration does */
  description: string;

  /**
   * Run the migration
   * @param dataPath - Path to the data directory
   * @throws Error if migration fails (causes rollback)
   */
  up(dataPath: string): Promise<void>;

  /**
   * Verify the migration was successful
   * @param dataPath - Path to the data directory
   * @returns true if migration was successful
   */
  verify(dataPath: string): Promise<boolean>;
}

/**
 * Migration result
 */
export interface MigrationResult {
  version: number;
  description: string;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * Migration run summary
 */
export interface MigrationSummary {
  startVersion: number;
  endVersion: number;
  migrations: MigrationResult[];
  success: boolean;
  totalDuration: number;
}
