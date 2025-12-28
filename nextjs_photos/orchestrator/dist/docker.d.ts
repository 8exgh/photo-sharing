import { ContainerStatus } from './types';
declare const PROD_CONTAINER: string;
declare const STAGING_CONTAINER: string;
/**
 * Get container status
 */
export declare function getContainerStatus(containerName: string): Promise<ContainerStatus>;
/**
 * Get status of both production and staging containers
 */
export declare function getAllContainerStatus(): Promise<{
    production: ContainerStatus;
    staging: ContainerStatus;
}>;
/**
 * Pull a new image from the registry
 */
export declare function pullImage(imageName: string, tag: string): Promise<void>;
/**
 * Stop a container
 */
export declare function stopContainer(containerName: string): Promise<void>;
/**
 * Start a container using docker compose
 * We use compose to ensure proper configuration is applied
 */
export declare function startContainerViaCompose(service: string): Promise<void>;
/**
 * Wait for container to be healthy
 */
export declare function waitForHealth(containerName: string, timeoutMs?: number): Promise<boolean>;
/**
 * Get container logs
 */
export declare function getContainerLogs(containerName: string, tail?: number): Promise<string>;
export { PROD_CONTAINER, STAGING_CONTAINER };
//# sourceMappingURL=docker.d.ts.map