"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
exports.getPendingMigrations = getPendingMigrations;
exports.hasPendingMigrations = hasPendingMigrations;
const schema_1 = require("../lib/schema");
// Import all migrations in order
const _001_initial_1 = require("./001_initial");
const _002_add_photo_dimensions_1 = require("./002_add_photo_dimensions");
// Register all migrations - MUST be in ascending version order
const migrations = [
    _001_initial_1.migration,
    _002_add_photo_dimensions_1.migration,
];
const DATA_DIR = process.env.DATA_DIR || './data';
/**
 * Run all pending migrations
 */
async function runMigrations() {
    const startTime = Date.now();
    const startVersion = await (0, schema_1.getCurrentSchemaVersion)();
    const results = [];
    console.log(`[MIGRATIONS] Current schema version: ${startVersion}`);
    console.log(`[MIGRATIONS] App schema version: ${schema_1.APP_SCHEMA_VERSION}`);
    if (startVersion >= schema_1.APP_SCHEMA_VERSION) {
        console.log('[MIGRATIONS] No migrations needed');
        return {
            startVersion,
            endVersion: startVersion,
            migrations: [],
            success: true,
            totalDuration: Date.now() - startTime,
        };
    }
    // Get migrations that need to run
    const pendingMigrations = migrations.filter(m => m.version > startVersion);
    if (pendingMigrations.length === 0) {
        console.log('[MIGRATIONS] No pending migrations found');
        return {
            startVersion,
            endVersion: startVersion,
            migrations: [],
            success: true,
            totalDuration: Date.now() - startTime,
        };
    }
    console.log(`[MIGRATIONS] Running ${pendingMigrations.length} migration(s)...`);
    let currentVersion = startVersion;
    for (const migration of pendingMigrations) {
        const migrationStart = Date.now();
        console.log(`[MIGRATIONS] Running migration ${migration.version}: ${migration.description}`);
        try {
            // Run the migration
            await migration.up(DATA_DIR);
            // Verify the migration
            const verified = await migration.verify(DATA_DIR);
            if (!verified) {
                throw new Error('Migration verification failed');
            }
            // Update schema version after successful migration
            await (0, schema_1.setSchemaVersion)(migration.version);
            currentVersion = migration.version;
            const result = {
                version: migration.version,
                description: migration.description,
                success: true,
                duration: Date.now() - migrationStart,
            };
            results.push(result);
            console.log(`[MIGRATIONS] Migration ${migration.version} completed in ${result.duration}ms`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[MIGRATIONS] Migration ${migration.version} FAILED: ${errorMessage}`);
            const result = {
                version: migration.version,
                description: migration.description,
                success: false,
                error: errorMessage,
                duration: Date.now() - migrationStart,
            };
            results.push(result);
            // FAIL FAST: Do not continue with other migrations
            return {
                startVersion,
                endVersion: currentVersion,
                migrations: results,
                success: false,
                totalDuration: Date.now() - startTime,
            };
        }
    }
    console.log(`[MIGRATIONS] All migrations completed successfully`);
    console.log(`[MIGRATIONS] Schema version: ${startVersion} -> ${currentVersion}`);
    return {
        startVersion,
        endVersion: currentVersion,
        migrations: results,
        success: true,
        totalDuration: Date.now() - startTime,
    };
}
/**
 * Get list of pending migrations
 */
async function getPendingMigrations() {
    const currentVersion = await (0, schema_1.getCurrentSchemaVersion)();
    return migrations.filter(m => m.version > currentVersion);
}
/**
 * Check if migrations are needed
 */
async function hasPendingMigrations() {
    const pending = await getPendingMigrations();
    return pending.length > 0;
}
