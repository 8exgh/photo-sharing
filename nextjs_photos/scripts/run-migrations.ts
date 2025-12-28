#!/usr/bin/env npx ts-node

/**
 * Migration runner script
 *
 * This script is called by docker-entrypoint.sh before starting the app.
 * It runs any pending migrations and exits with code 1 on failure.
 *
 * Usage: npx ts-node scripts/run-migrations.ts
 * Or in production: node scripts/run-migrations.js
 */

import { runMigrations } from '../src/migrations';
import { getSchemaStatus } from '../src/lib/schema';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('TIK PHOTOS - MIGRATION RUNNER');
  console.log('='.repeat(60));

  try {
    const status = await getSchemaStatus();
    console.log(`Current schema version: ${status.currentVersion}`);
    console.log(`App schema version: ${status.appVersion}`);

    if (!status.needsMigration) {
      console.log('No migrations needed. Schema is up to date.');
      console.log('='.repeat(60));
      process.exit(0);
    }

    console.log(`Migration needed: v${status.currentVersion} -> v${status.appVersion}`);
    console.log('-'.repeat(60));

    const result = await runMigrations();

    console.log('-'.repeat(60));

    if (result.success) {
      console.log('MIGRATIONS COMPLETED SUCCESSFULLY');
      console.log(`Schema version: ${result.startVersion} -> ${result.endVersion}`);
      console.log(`Total duration: ${result.totalDuration}ms`);
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.error('MIGRATIONS FAILED');
      console.error(`Failed at version: ${result.migrations[result.migrations.length - 1]?.version}`);
      console.error(`Error: ${result.migrations[result.migrations.length - 1]?.error}`);
      console.log('='.repeat(60));
      console.error('');
      console.error('The application will NOT start until migrations are fixed.');
      console.error('Please check the error above and fix the data issue.');
      process.exit(1);
    }
  } catch (error) {
    console.error('='.repeat(60));
    console.error('FATAL ERROR during migration');
    console.error(error);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

main();
