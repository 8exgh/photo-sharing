'use client';

import { useState, useEffect } from 'react';
import { SystemInfo, Release, UpgradeState } from '@/types';

interface SystemStatusData {
  system: SystemInfo;
  orchestrator?: {
    production?: { status: string; version: string };
    staging?: { status: string; version: string };
    upgrade?: UpgradeState;
  };
}

interface Props {
  onUpgradeClick?: (release: Release) => void;
}

export default function SystemStatus({ onUpgradeClick }: Props) {
  const [status, setStatus] = useState<SystemStatusData | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();

    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/system/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        // Fetch releases after we have the version
        if (data.system?.version) {
          fetchReleases(data.system.version);
        }
      }
    } catch (err) {
      console.error('Error fetching system status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReleases = async (currentVersion: string) => {
    try {
      const response = await fetch('/api/system/releases?currentVersion=' + currentVersion);
      if (response.ok) {
        const data = await response.json();
        if (data.updateAvailable && data.latestRelease) {
          setUpdateAvailable(data.latestRelease);
        }
      }
    } catch (err) {
      console.error('Error fetching releases:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-700 shadow rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-slate-600 rounded w-32 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-600 rounded w-48"></div>
          <div className="h-4 bg-slate-600 rounded w-36"></div>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const { system } = status;
  const instanceBadgeColor = {
    production: 'bg-green-600',
    staging: 'bg-yellow-600',
    development: 'bg-blue-600',
  }[system.instanceType];

  return (
    <div className="bg-slate-700 shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold text-slate-100">System Status</h2>
        <span className={`px-2 py-1 text-xs font-medium rounded ${instanceBadgeColor} text-white uppercase`}>
          {system.instanceType}
        </span>
      </div>

      {updateAvailable && (
        <div className="mb-4 p-3 bg-blue-900/50 border border-blue-600 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-blue-200">
                New version available: <strong>v{updateAvailable.version}</strong>
              </span>
            </div>
            {onUpgradeClick && (
              <button
                onClick={() => onUpgradeClick(updateAvailable)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View Details
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Version</span>
          <span className="text-slate-200 font-mono">v{system.version}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Git Hash</span>
          <span className="text-slate-200 font-mono">{system.gitHash.substring(0, 7)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Branch</span>
          <span className="text-slate-200 font-mono">{system.gitBranch}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Build</span>
          <span className="text-slate-200">#{system.buildNumber}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Schema Version</span>
          <span className="text-slate-200">
            {system.schemaVersion}
            {system.needsMigration && (
              <span className="ml-2 text-yellow-400">(migration pending)</span>
            )}
          </span>
        </div>

        {system.buildTime !== 'unknown' && (
          <div className="flex justify-between">
            <span className="text-slate-400">Built</span>
            <span className="text-slate-200">
              {new Date(system.buildTime).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {status.orchestrator && (
        <div className="mt-4 pt-4 border-t border-slate-600">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Orchestrator Status</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Production</span>
              <span className={`px-2 py-0.5 rounded ${
                status.orchestrator.production?.status === 'running'
                  ? 'bg-green-900 text-green-300'
                  : 'bg-red-900 text-red-300'
              }`}>
                {status.orchestrator.production?.status || 'unknown'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Staging</span>
              <span className={`px-2 py-0.5 rounded ${
                status.orchestrator.staging?.status === 'running'
                  ? 'bg-green-900 text-green-300'
                  : 'bg-slate-600 text-slate-400'
              }`}>
                {status.orchestrator.staging?.status || 'not running'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
