"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_SCHEMA_VERSION = void 0;
exports.getCurrentSchemaVersion = getCurrentSchemaVersion;
exports.getAppSchemaVersion = getAppSchemaVersion;
exports.needsMigration = needsMigration;
exports.setSchemaVersion = setSchemaVersion;
exports.getSchemaStatus = getSchemaStatus;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
// The current app schema version - increment when adding new migrations
exports.APP_SCHEMA_VERSION = 2;
const DATA_DIR = process.env.DATA_DIR || './data';
const SCHEMA_VERSION_FILE = '.schema-version';
/**
 * Get the current schema version from the data directory
 * Returns 0 if no version file exists (fresh install)
 */
async function getCurrentSchemaVersion() {
    const versionPath = path_1.default.join(DATA_DIR, SCHEMA_VERSION_FILE);
    try {
        const content = await fs_1.promises.readFile(versionPath, 'utf-8');
        const version = parseInt(content.trim(), 10);
        if (isNaN(version) || version < 0) {
            throw new Error(`Invalid schema version in ${versionPath}: ${content}`);
        }
        return version;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            // No version file = fresh install, assume version 0
            return 0;
        }
        throw error;
    }
}
/**
 * Get the schema version built into this app
 */
function getAppSchemaVersion() {
    return exports.APP_SCHEMA_VERSION;
}
/**
 * Check if migrations are needed
 */
async function needsMigration() {
    const currentVersion = await getCurrentSchemaVersion();
    return currentVersion < exports.APP_SCHEMA_VERSION;
}
/**
 * Update the schema version file after successful migration
 */
async function setSchemaVersion(version) {
    const versionPath = path_1.default.join(DATA_DIR, SCHEMA_VERSION_FILE);
    await fs_1.promises.writeFile(versionPath, String(version), 'utf-8');
}
/**
 * Get schema status for system info
 */
async function getSchemaStatus() {
    const currentVersion = await getCurrentSchemaVersion();
    const appVersion = exports.APP_SCHEMA_VERSION;
    return {
        currentVersion,
        appVersion,
        needsMigration: currentVersion < appVersion,
    };
}
