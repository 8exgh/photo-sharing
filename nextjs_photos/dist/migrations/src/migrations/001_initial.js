"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migration = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * Migration 001: Initial schema
 *
 * This migration establishes the base schema for existing installations.
 * It ensures required files exist and have valid JSON structure.
 */
exports.migration = {
    version: 1,
    description: 'Initial schema - ensure base files exist',
    async up(dataPath) {
        // Ensure access-keys.json exists
        const accessKeysPath = path_1.default.join(dataPath, 'access-keys.json');
        try {
            await fs_1.promises.access(accessKeysPath);
            // Validate it's valid JSON
            const content = await fs_1.promises.readFile(accessKeysPath, 'utf-8');
            JSON.parse(content);
        }
        catch (_a) {
            // Create empty access keys file
            await fs_1.promises.writeFile(accessKeysPath, JSON.stringify({ keys: [] }, null, 2));
        }
        // Ensure groups.json exists
        const groupsPath = path_1.default.join(dataPath, 'groups.json');
        try {
            await fs_1.promises.access(groupsPath);
            // Validate it's valid JSON
            const content = await fs_1.promises.readFile(groupsPath, 'utf-8');
            JSON.parse(content);
        }
        catch (_b) {
            // Create empty groups file
            await fs_1.promises.writeFile(groupsPath, JSON.stringify({ groups: {} }, null, 2));
        }
        // Ensure albums directory exists
        const albumsPath = path_1.default.join(dataPath, 'albums');
        try {
            await fs_1.promises.access(albumsPath);
        }
        catch (_c) {
            await fs_1.promises.mkdir(albumsPath, { recursive: true });
        }
    },
    async verify(dataPath) {
        try {
            // Check access-keys.json
            const accessKeysPath = path_1.default.join(dataPath, 'access-keys.json');
            const accessKeysContent = await fs_1.promises.readFile(accessKeysPath, 'utf-8');
            const accessKeys = JSON.parse(accessKeysContent);
            if (!accessKeys || typeof accessKeys !== 'object') {
                return false;
            }
            // Check groups.json
            const groupsPath = path_1.default.join(dataPath, 'groups.json');
            const groupsContent = await fs_1.promises.readFile(groupsPath, 'utf-8');
            const groups = JSON.parse(groupsContent);
            if (!groups || typeof groups !== 'object') {
                return false;
            }
            // Check albums directory exists
            const albumsPath = path_1.default.join(dataPath, 'albums');
            const stat = await fs_1.promises.stat(albumsPath);
            if (!stat.isDirectory()) {
                return false;
            }
            return true;
        }
        catch (_a) {
            return false;
        }
    },
};
