'use client';

import { useState, useEffect } from 'react';

interface Props {
  onPromoteClick?: () => void;
}

export default function StagingBanner({ onPromoteClick }: Props) {
  const [instanceType, setInstanceType] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const fetchSystemInfo = async () => {
    try {
      const response = await fetch('/api/system/status');
      if (response.ok) {
        const data = await response.json();
        setInstanceType(data.system?.instanceType);
        setVersion(data.system?.version);
        setIsAdmin(true); // If we got the status, we're an admin
      }
    } catch (_err) {
      // Not logged in as admin, that's fine
    }
  };

  // Only show banner on staging instances
  if (instanceType !== 'staging') {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <span className="font-semibold">STAGING ENVIRONMENT</span>
            </div>
            {version && (
              <span className="text-yellow-200">
                Version: <span className="font-mono">v{version}</span>
              </span>
            )}
          </div>

          {isAdmin && onPromoteClick && (
            <button
              onClick={onPromoteClick}
              className="flex items-center space-x-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
            >
              <span>Promote to Production</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
