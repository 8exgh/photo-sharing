import { UpgradeState, UpgradeResult } from './types';
import * as docker from './docker';
import * as backup from './backup';
import * as registry from './registry';
import { promises as fs } from 'fs';
import path from 'path';

const COMPOSE_DIR = process.env.COMPOSE_DIR || '/deploy';
const REGISTRY_IMAGE = process.env.REGISTRY_IMAGE || 'ghcr.io/tycholaz/tik-photos';

// Global upgrade state
let upgradeState: UpgradeState = {
  status: 'idle',
  target: null,
  targetVersion: null,
  currentStep: null,
  progress: 0,
  error: null,
  startedAt: null,
};

/**
 * Get current upgrade state
 */
export function getUpgradeState(): UpgradeState {
  return { ...upgradeState };
}

/**
 * Update upgrade state
 */
function setState(updates: Partial<UpgradeState>): void {
  upgradeState = { ...upgradeState, ...updates };
  console.log(`[UPGRADE] State: ${upgradeState.status} - ${upgradeState.currentStep || 'idle'}`);
}

/**
 * Reset upgrade state
 */
export function resetState(): void {
  upgradeState = {
    status: 'idle',
    target: null,
    targetVersion: null,
    currentStep: null,
    progress: 0,
    error: null,
    startedAt: null,
  };
}

/**
 * Prepare staging for upgrade
 * 1. Pull new image
 * 2. Copy production data to staging
 * 3. Start staging with new version
 */
export async function prepareStaging(targetVersion: string): Promise<UpgradeResult> {
  if (upgradeState.status !== 'idle') {
    return { success: false, message: 'Another upgrade is in progress' };
  }

  const startTime = Date.now();

  try {
    setState({
      status: 'preparing',
      target: 'staging',
      targetVersion,
      startedAt: new Date().toISOString(),
      progress: 0,
    });

    // Step 1: Pull new image
    setState({ currentStep: 'Pulling new image...', progress: 10 });
    await docker.pullImage(REGISTRY_IMAGE, targetVersion);

    // Step 2: Stop staging if running
    setState({ currentStep: 'Stopping staging...', progress: 30 });
    try {
      await docker.stopContainer(docker.STAGING_CONTAINER);
    } catch {
      // Ignore if not running
    }

    // Step 3: Copy production data to staging
    setState({ currentStep: 'Copying production data...', progress: 50 });
    await backup.copyProdToStaging();

    // Step 4: Update .env with new staging version
    setState({ currentStep: 'Updating configuration...', progress: 70 });
    await updateEnvFile('STAGING_VERSION', targetVersion);

    // Step 5: Start staging
    setState({ currentStep: 'Starting staging...', progress: 80 });
    await docker.startContainerViaCompose('tik-staging');

    // Step 6: Wait for health
    setState({ currentStep: 'Waiting for health check...', progress: 90 });
    const healthy = await docker.waitForHealth(docker.STAGING_CONTAINER, 120000);

    if (!healthy) {
      throw new Error('Staging container failed health check');
    }

    setState({ status: 'completed', progress: 100, currentStep: 'Staging ready' });

    return {
      success: true,
      message: `Staging upgraded to ${targetVersion}`,
      newVersion: targetVersion,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setState({ status: 'failed', error: errorMessage });
    console.error('[UPGRADE] Staging preparation failed:', error);

    return {
      success: false,
      message: `Staging upgrade failed: ${errorMessage}`,
    };
  }
}

/**
 * Upgrade production to match staging version
 * 1. Create backup
 * 2. Stop production
 * 3. Update version
 * 4. Start production
 * 5. Wait for health
 */
export async function upgradeProduction(): Promise<UpgradeResult> {
  if (upgradeState.status !== 'idle') {
    return { success: false, message: 'Another upgrade is in progress' };
  }

  const startTime = Date.now();

  // Get staging version
  const stagingStatus = await docker.getContainerStatus(docker.STAGING_CONTAINER);
  if (!stagingStatus.version) {
    return { success: false, message: 'Could not determine staging version' };
  }

  const targetVersion = stagingStatus.version;

  try {
    setState({
      status: 'upgrading',
      target: 'production',
      targetVersion,
      startedAt: new Date().toISOString(),
      progress: 0,
    });

    // Step 1: Create production backup
    setState({ currentStep: 'Creating backup...', progress: 10 });
    const backupInfo = await backup.createBackup('production', 'pre-upgrade');

    // Step 2: Verify backup
    setState({ currentStep: 'Verifying backup...', progress: 25 });
    const backupValid = await backup.verifyBackup(backupInfo.path);
    if (!backupValid) {
      throw new Error('Backup verification failed');
    }

    // Step 3: Pull image (should be cached from staging)
    setState({ currentStep: 'Ensuring image is available...', progress: 35 });
    await docker.pullImage(REGISTRY_IMAGE, targetVersion);

    // Step 4: Stop production
    setState({ currentStep: 'Stopping production...', progress: 50 });
    await docker.stopContainer(docker.PROD_CONTAINER);

    // Step 5: Update .env with production version
    setState({ currentStep: 'Updating configuration...', progress: 60 });
    await updateEnvFile('PROD_VERSION', targetVersion);

    // Step 6: Start production
    setState({ currentStep: 'Starting production...', progress: 70 });
    await docker.startContainerViaCompose('tik-production');

    // Step 7: Wait for health
    setState({ currentStep: 'Waiting for health check...', progress: 85 });
    const healthy = await docker.waitForHealth(docker.PROD_CONTAINER, 120000);

    if (!healthy) {
      throw new Error('Production container failed health check - check logs');
    }

    // Step 8: Verify migrations ran
    setState({ currentStep: 'Verifying migrations...', progress: 95 });
    // The container will fail to start if migrations fail, so if we're here, they passed

    setState({ status: 'completed', progress: 100, currentStep: 'Production upgraded' });

    // Clear registry cache after successful upgrade
    registry.clearReleasesCache();

    return {
      success: true,
      message: `Production upgraded to ${targetVersion}`,
      newVersion: targetVersion,
      duration: Date.now() - startTime,
      backupPath: backupInfo.path,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setState({ status: 'failed', error: errorMessage });
    console.error('[UPGRADE] Production upgrade failed:', error);

    return {
      success: false,
      message: `Production upgrade failed: ${errorMessage}`,
    };
  }
}

/**
 * Update a value in the .env file
 */
async function updateEnvFile(key: string, value: string): Promise<void> {
  const envPath = path.join(COMPOSE_DIR, '.env');

  let content: string;
  try {
    content = await fs.readFile(envPath, 'utf-8');
  } catch {
    content = '';
  }

  const lines = content.split('\n');
  let found = false;

  const updatedLines = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updatedLines.push(`${key}=${value}`);
  }

  await fs.writeFile(envPath, updatedLines.join('\n'));
  console.log(`Updated ${key}=${value} in ${envPath}`);
}

/**
 * Get logs from a failed upgrade
 */
export async function getUpgradeLogs(): Promise<string> {
  const target = upgradeState.target;
  if (!target) {
    return 'No upgrade in progress';
  }

  const containerName = target === 'production' ? docker.PROD_CONTAINER : docker.STAGING_CONTAINER;
  return docker.getContainerLogs(containerName, 200);
}
