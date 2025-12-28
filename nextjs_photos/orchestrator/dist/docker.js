"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGING_CONTAINER = exports.PROD_CONTAINER = void 0;
exports.getContainerStatus = getContainerStatus;
exports.getAllContainerStatus = getAllContainerStatus;
exports.pullImage = pullImage;
exports.stopContainer = stopContainer;
exports.startContainerViaCompose = startContainerViaCompose;
exports.waitForHealth = waitForHealth;
exports.getContainerLogs = getContainerLogs;
const dockerode_1 = __importDefault(require("dockerode"));
const docker = new dockerode_1.default({ socketPath: '/var/run/docker.sock' });
const PROD_CONTAINER = process.env.PROD_CONTAINER || 'tik-production';
exports.PROD_CONTAINER = PROD_CONTAINER;
const STAGING_CONTAINER = process.env.STAGING_CONTAINER || 'tik-staging';
exports.STAGING_CONTAINER = STAGING_CONTAINER;
/**
 * Get container status
 */
async function getContainerStatus(containerName) {
    try {
        const containers = await docker.listContainers({ all: true });
        const container = containers.find(c => c.Names.some(n => n === `/${containerName}` || n === containerName));
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
    }
    catch (error) {
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
async function getAllContainerStatus() {
    const [production, staging] = await Promise.all([
        getContainerStatus(PROD_CONTAINER),
        getContainerStatus(STAGING_CONTAINER),
    ]);
    return { production, staging };
}
/**
 * Pull a new image from the registry
 */
async function pullImage(imageName, tag) {
    const fullImage = `${imageName}:${tag}`;
    console.log(`Pulling image: ${fullImage}`);
    return new Promise((resolve, reject) => {
        docker.pull(fullImage, (err, stream) => {
            if (err) {
                return reject(err);
            }
            docker.modem.followProgress(stream, (err) => {
                if (err) {
                    reject(err);
                }
                else {
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
async function stopContainer(containerName) {
    console.log(`Stopping container: ${containerName}`);
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => c.Names.some(n => n === `/${containerName}` || n === containerName));
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
async function startContainerViaCompose(service) {
    console.log(`Starting service via compose: ${service}`);
    const { exec } = await Promise.resolve().then(() => __importStar(require('child_process')));
    const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
    const execAsync = promisify(exec);
    const composeDir = process.env.COMPOSE_DIR || '/deploy';
    const { stdout, stderr } = await execAsync(`docker compose -f ${composeDir}/docker-compose.yml up -d ${service}`);
    if (stdout)
        console.log(stdout);
    if (stderr)
        console.error(stderr);
    console.log(`Service ${service} started`);
}
/**
 * Wait for container to be healthy
 */
async function waitForHealth(containerName, timeoutMs = 60000) {
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
async function getContainerLogs(containerName, tail = 100) {
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => c.Names.some(n => n === `/${containerName}` || n === containerName));
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
//# sourceMappingURL=docker.js.map