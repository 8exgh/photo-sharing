import express from 'express';
import cors from 'cors';
import * as docker from './docker';
import * as registry from './registry';
import * as backup from './backup';
import * as upgrade from './upgrade';
import { SystemStatus } from './types';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const startTime = Date.now();

app.use(cors());
app.use(express.json());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Date.now() - startTime });
});

/**
 * Get system status
 */
app.get('/api/status', async (req, res) => {
  try {
    const { production, staging } = await docker.getAllContainerStatus();
    const upgradeState = upgrade.getUpgradeState();

    const status: SystemStatus & { upgrade: typeof upgradeState } = {
      production,
      staging,
      orchestrator: {
        version: process.env.npm_package_version || '1.0.0',
        uptime: Date.now() - startTime,
      },
      upgrade: upgradeState,
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

/**
 * Get available releases
 */
app.get('/api/releases', async (req, res) => {
  try {
    const releases = await registry.getAvailableReleases();
    res.json({ releases });
  } catch (error) {
    console.error('Error getting releases:', error);
    res.status(500).json({ error: 'Failed to get releases' });
  }
});

/**
 * Check for updates
 */
app.get('/api/updates', async (req, res) => {
  try {
    const currentVersion = req.query.version as string;
    if (!currentVersion) {
      return res.status(400).json({ error: 'version parameter required' });
    }

    const result = await registry.checkForUpdates(currentVersion);
    res.json(result);
  } catch (error) {
    console.error('Error checking updates:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

/**
 * Get release notes for a specific version
 */
app.get('/api/releases/:version/notes', async (req, res) => {
  try {
    const notes = await registry.getReleaseNotes(req.params.version);
    if (!notes) {
      return res.status(404).json({ error: 'Release notes not found' });
    }
    res.json({ notes });
  } catch (error) {
    console.error('Error getting release notes:', error);
    res.status(500).json({ error: 'Failed to get release notes' });
  }
});

/**
 * Prepare staging for upgrade
 */
app.post('/api/staging/prepare', async (req, res) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(400).json({ error: 'version is required' });
    }

    const result = await upgrade.prepareStaging(version);
    res.json(result);
  } catch (error) {
    console.error('Error preparing staging:', error);
    res.status(500).json({ error: 'Failed to prepare staging' });
  }
});

/**
 * Get upgrade state
 */
app.get('/api/upgrade/state', (req, res) => {
  res.json(upgrade.getUpgradeState());
});

/**
 * Reset upgrade state (only if idle or failed)
 */
app.post('/api/upgrade/reset', (req, res) => {
  const state = upgrade.getUpgradeState();
  if (state.status === 'preparing' || state.status === 'upgrading' || state.status === 'verifying') {
    return res.status(400).json({ error: 'Cannot reset while upgrade is in progress' });
  }
  upgrade.resetState();
  res.json({ success: true });
});

/**
 * Get upgrade logs (for debugging failed upgrades)
 */
app.get('/api/upgrade/logs', async (req, res) => {
  try {
    const logs = await upgrade.getUpgradeLogs();
    res.json({ logs });
  } catch (error) {
    console.error('Error getting upgrade logs:', error);
    res.status(500).json({ error: 'Failed to get upgrade logs' });
  }
});

/**
 * Upgrade production
 */
app.post('/api/production/upgrade', async (req, res) => {
  try {
    const result = await upgrade.upgradeProduction();
    res.json(result);
  } catch (error) {
    console.error('Error upgrading production:', error);
    res.status(500).json({ error: 'Failed to upgrade production' });
  }
});

/**
 * Create backup
 */
app.post('/api/backup', async (req, res) => {
  try {
    const { type, reason } = req.body;
    if (!type || (type !== 'production' && type !== 'staging')) {
      return res.status(400).json({ error: 'type must be production or staging' });
    }

    const backupInfo = await backup.createBackup(type, reason || 'manual');
    res.json({ success: true, backup: backupInfo });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

/**
 * List backups
 */
app.get('/api/backups', async (req, res) => {
  try {
    const backups = await backup.listBackups();
    res.json({ backups });
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

/**
 * Delete a backup
 */
app.delete('/api/backups/:filename', async (req, res) => {
  try {
    await backup.deleteBackup(req.params.filename);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

/**
 * Get container logs
 */
app.get('/api/logs/:container', async (req, res) => {
  try {
    const container = req.params.container;
    const tail = parseInt(req.query.tail as string, 10) || 100;

    const containerName = container === 'production'
      ? docker.PROD_CONTAINER
      : container === 'staging'
        ? docker.STAGING_CONTAINER
        : container;

    const logs = await docker.getContainerLogs(containerName, tail);
    res.json({ logs });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('TIK PHOTOS ORCHESTRATOR');
  console.log('='.repeat(60));
  console.log(`Server started on port ${PORT}`);
  console.log(`Data path: ${process.env.DATA_PATH || '/data'}`);
  console.log(`Backup path: ${process.env.BACKUP_PATH || '/backups'}`);
  console.log(`Compose dir: ${process.env.COMPOSE_DIR || '/deploy'}`);
  console.log('='.repeat(60));
});
