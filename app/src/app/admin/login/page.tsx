'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/setup')
      .then((res) => res.json())
      .then((data) => setNeedsSetup(!!data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (needsSetup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(needsSetup ? '/api/auth/claim' : '/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push('/admin');
      } else {
        const data = await response.json();
        if (data.needsSetup) {
          // Password was never set - switch to the claim form
          setNeedsSetup(true);
          setError('No admin password has been set yet. Choose one below.');
        } else {
          setError(data.error || (needsSetup ? 'Setup failed' : 'Login failed'));
        }
      }
    } catch (_err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-800">
        <div className="text-lg text-slate-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800">
      <div className={`max-w-md w-full space-y-8 ${error ? 'mt-20' : ''}`}>
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-100">
            {needsSetup ? 'Set Admin Password' : 'Admin Login'}
          </h2>
          {needsSetup && (
            <p className="mt-2 text-center text-sm text-slate-300">
              No admin password has been set for this site yet. Choose one now to
              claim the admin account.
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={needsSetup ? 8 : undefined}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-600 placeholder-slate-400 text-slate-100 bg-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder={needsSetup ? 'New admin password (min 8 characters)' : 'Admin password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {needsSetup && (
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-600 placeholder-slate-400 text-slate-100 bg-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            )}
          </div>

          {error && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-red-900 text-red-100 border-b border-red-700 shadow-lg">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-center">
                  <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading
                ? (needsSetup ? 'Setting password...' : 'Logging in...')
                : (needsSetup ? 'Set password & sign in' : 'Sign in')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
