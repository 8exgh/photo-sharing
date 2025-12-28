/**
 * Types for the orchestrator service
 */

export interface ContainerStatus {
  name: string;
  id: string;
  status: 'running' | 'stopped' | 'not_found';
  version: string | null;
  health: 'healthy' | 'unhealthy' | 'unknown';
  uptime: string | null;
}

export interface SystemStatus {
  production: ContainerStatus;
  staging: ContainerStatus;
  orchestrator: {
    version: string;
    uptime: number;
  };
}

export interface Release {
  version: string;
  tag: string;
  publishedAt: string;
  releaseNotes: string;
  digest: string;
}

export interface BackupInfo {
  filename: string;
  path: string;
  createdAt: string;
  size: number;
  type: 'production' | 'staging';
}

export interface UpgradeState {
  status: 'idle' | 'preparing' | 'upgrading' | 'verifying' | 'completed' | 'failed';
  target: 'staging' | 'production' | null;
  targetVersion: string | null;
  currentStep: string | null;
  progress: number;
  error: string | null;
  startedAt: string | null;
}

export interface UpgradeResult {
  success: boolean;
  message: string;
  newVersion?: string;
  duration?: number;
  backupPath?: string;
}
