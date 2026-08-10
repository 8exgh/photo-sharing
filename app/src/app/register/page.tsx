'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (response.ok) {
        setRegistered(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Registration failed');
      }
    } catch (_err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-800">
        <div className="max-w-md w-full space-y-6 text-center">
          <h2 className="text-3xl font-extrabold text-slate-100">Check your email</h2>
          <p className="text-slate-300">
            We sent a verification link to <span className="text-slate-100 font-medium">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link href="/admin/login" className="text-blue-400 hover:text-blue-300">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800">
      <div className={`max-w-md w-full space-y-8 ${error ? 'mt-20' : ''}`}>
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-100">
            Create Your Album Site
          </h2>
          <p className="mt-2 text-center text-sm text-slate-300">
            Pick a username and password. We&apos;ll email you a verification link
            to activate your account. Your photos stay private — only people you
            give an access key to can see them.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <label htmlFor="username" className="sr-only">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[a-z0-9][a-z0-9-]{1,30}[a-z0-9]"
              title="3-32 characters: lowercase letters, digits, and hyphens (no leading or trailing hyphen)"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-600 placeholder-slate-400 text-slate-100 bg-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Username (lowercase letters, digits, hyphens)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-600 placeholder-slate-400 text-slate-100 bg-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-600 placeholder-slate-400 text-slate-100 bg-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="confirmPassword" className="sr-only">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-600 placeholder-slate-400 text-slate-100 bg-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
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
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>

          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/admin/login" className="text-blue-400 hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
