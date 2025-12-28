import Docker from 'dockerode';
import { ContainerStatus } from './types';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const PROD_CONTAINER = process.env.PROD_CONTAINER || 'tik-production';
const STAGING_CONTAINER = process.env.STAGING_CONTAINER || 'tik-staging';

/**
 * Get container status
 */
export async function getContainerStatus(containerName: string): Promise<ContainerStatus> {
  try {
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c =>
      c.Names.some(n => n === `/${containerName}` || n === containerName)
    );

    if (!container) {
      return {
        name: containerName,
        id: '',
        status: 'not_found',
        version: null,
        health: 'unknown',
        uptime: null,
      };
    }

    const inspection = await docker.getContainer(container.Id).inspect();
    const version = inspection.Config.Image.split(':')[1] || 'latest';
    const healthStatus = inspection.State.Health?.Status;

    return {
      name: containerName,
      id: container.Id.substring(0, 12),
      status: container.State === 'running' ? 'running' : 'stopped',
      version,
      health: healthStatus === 'healthy' ? 'healthy' : healthStatus === 'unhealthy' ? 'unhealthy' : 'unknown',
      uptime: container.Status,
    };
  } catch (error) {
    console.error(`Error getting container status for ${containerName}:`, error);
    return {
      name: containerName,
      id: '',
      status: 'not_found',
      version: null,
      health: 'unknown',
      uptime: null,
    };
  }
}

/**
 * Get status of both production and staging containers
 */
export async function getAllContainerStatus(): Promise<{ production: ContainerStatus; staging: ContainerStatus }> {
  const [production, staging] = await Promise.all([
    getContainerStatus(PROD_CONTAINER),
    getContainerStatus(STAGING_CONTAINER),
  ]);
  return { production, staging };
}

/**
 * Pull a new image from the registry
 */
export async function pullImage(imageName: string, tag: string): Promise<void> {
  const fullImage = `${imageName}:${tag}`;
  console.log(`Pulling image: ${fullImage}`);

  return new Promise((resolve, reject) => {
    docker.pull(fullImage, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) {
        return reject(err);
      }

      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Successfully pulled: ${fullImage}`);
          resolve();
        }
      });
    });
  });
}

/**
 * Stop a container
 */
export async function stopContainer(containerName: string): Promise<void> {
  console.log(`Stopping container: ${containerName}`);
  const containers = await docker.listContainers({ all: true });
  const container = containers.find(c =>
    c.Names.some(n => n === `/${containerName}` || n === containerName)
  );

  if (!container) {
    console.log(`Container ${containerName} not found, nothing to stop`);
    return;
  }

  const dockerContainer = docker.getContainer(container.Id);
  await dockerContainer.stop();
  console.log(`Container ${containerName} stopped`);
}

/**
 * Start a container using docker compose
 * We use compose to ensure proper configuration is applied
 */
export async function startContainerViaCompose(service: string): Promise<void> {
  console.log(`Starting service via compose: ${service}`);

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const composeDir = process.env.COMPOSE_DIR || '/deploy';
  const { stdout, stderr } = await execAsync(`docker compose -f ${composeDir}/docker-compose.yml up -d ${service}`);

  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  console.log(`Service ${service} started`);
}

/**
 * Wait for container to be healthy
 */
export async function waitForHealth(containerName: string, timeoutMs: number = 60000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 2000;

  console.log(`Waiting for ${containerName} to be healthy (timeout: ${timeoutMs}ms)`);

  while (Date.now() - startTime < timeoutMs) {
    const status = await getContainerStatus(containerName);

    if (status.status === 'running' && status.health === 'healthy') {
      console.log(`${containerName} is healthy`);
      return true;
    }

    if (status.status === 'stopped' || status.status === 'not_found') {
      console.error(`${containerName} is not running`);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.error(`Timeout waiting for ${containerName} to be healthy`);
  return false;
}

/**
 * Get container logs
 */
export async function getContainerLogs(containerName: string, tail: number = 100): Promise<string> {
  const containers = await docker.listContainers({ all: true });
  const container = containers.find(c =>
    c.Names.some(n => n === `/${containerName}` || n === containerName)
  );

  if (!container) {
    return 'Container not found';
  }

  const dockerContainer = docker.getContainer(container.Id);
  const logs = await dockerContainer.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });

  return logs.toString();
}

export { PROD_CONTAINER, STAGING_CONTAINER };
