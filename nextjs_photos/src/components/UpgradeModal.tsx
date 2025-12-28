'use client';

import { useState, useEffect } from 'react';
import { Release, UpgradeState } from '@/types';

interface Props {
  release: Release;
  instanceType: 'production' | 'staging' | 'development';
  onClose: () => void;
  onUpgradeComplete?: () => void;
}

export default function UpgradeModal({ release, instanceType, onClose, onUpgradeComplete }: Props) {
  const [upgradeState, setUpgradeState] = useState<UpgradeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    // Poll for upgrade state while upgrading
    if (isUpgrading) {
      const interval = setInterval(fetchUpgradeState, 2000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpgrading]);

  const fetchUpgradeState = async () => {
    try {
      const response = await fetch('/api/system/upgrade');
      if (response.ok) {
        const state = await response.json();
        setUpgradeState(state);

        if (state.status === 'completed') {
          setIsUpgrading(false);
          onUpgradeComplete?.();
        } else if (state.status === 'failed') {
          setIsUpgrading(false);
          setError(state.error || 'Upgrade failed');
        }
      }
    } catch (err) {
      console.error('Error fetching upgrade state:', err);
    }
  };

  const handleStartUpgrade = async () => {
    setError(null);
    setIsUpgrading(true);

    try {
      const action = instanceType === 'staging' ? 'prepare-staging' : 'upgrade-production';

      const response = await fetch('/api/system/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          version: release.version,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || result.error || 'Upgrade failed');
        setIsUpgrading(false);
      }
    } catch (_err) {
      setError('Network error');
      setIsUpgrading(false);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/system/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      setUpgradeState(null);
      setError(null);
    } catch (err) {
      console.error('Error resetting upgrade state:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              {instanceType === 'staging' ? 'Prepare Staging' : 'Upgrade Production'}
            </h2>
            <p className="text-sm text-slate-400">Version {release.version}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isUpgrading}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Release Notes */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Release Notes</h3>
            <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {release.releaseNotes || 'No release notes available.'}
            </div>
          </div>

          {/* Progress Section */}
          {(isUpgrading || upgradeState) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-300 mb-2">Progress</h3>
              <div className="bg-slate-900 rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">
                    {upgradeState?.currentStep || 'Preparing...'}
                  </span>
                  <span className="text-sm text-slate-400">
                    {upgradeState?.progress || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      upgradeState?.status === 'failed' ? 'bg-red-600' :
                      upgradeState?.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${upgradeState?.progress || 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-200">{error}</p>
                  <button
                    onClick={handleReset}
                    className="mt-2 text-sm text-red-400 hover:text-red-300"
                  >
                    Reset and try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Display */}
          {upgradeState?.status === 'completed' && (
            <div className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-200">
                  {instanceType === 'staging'
                    ? 'Staging is ready! Test the new version and then promote to production.'
                    : 'Production upgrade completed successfully!'}
                </p>
              </div>
            </div>
          )}

          {/* Staging-specific instructions */}
          {instanceType === 'production' && !isUpgrading && !upgradeState && (
            <div className="mb-6 p-4 bg-yellow-900/50 border border-yellow-700 rounded">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-yellow-200 text-sm">
                  <p className="font-medium mb-1">Before upgrading production:</p>
                  <ul className="list-disc list-inside space-y-1 text-yellow-300">
                    <li>Ensure you have tested this version on staging</li>
                    <li>A backup will be created automatically</li>
                    <li>The app will be briefly unavailable during upgrade</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isUpgrading}
            className="px-4 py-2 text-slate-300 bg-slate-600 rounded hover:bg-slate-500 disabled:opacity-50"
          >
            {upgradeState?.status === 'completed' ? 'Close' : 'Cancel'}
          </button>

          {!upgradeState?.status || upgradeState.status === 'idle' ? (
            <button
              onClick={handleStartUpgrade}
              disabled={isUpgrading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {isUpgrading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Upgrading...</span>
                </>
              ) : (
                <span>
                  {instanceType === 'staging' ? 'Prepare Staging' : 'Upgrade Production'}
                </span>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
