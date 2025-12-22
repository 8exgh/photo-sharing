import { getIronSession } from 'iron-session';
import { SessionData } from '@/types';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Log session configuration for debugging
const isProduction = process.env.NODE_ENV === 'production';

// Use sessionSecret without validation at module level (for build compatibility)
const sessionSecret = process.env.SESSION_SECRET || 'change-this-to-a-secure-secret-key-at-least-32-characters-long';

// Track if we've validated the secret (only validate once per runtime)
let hasValidatedSecret = false;

console.log('[Session Config] Initializing with:', {
  environment: process.env.NODE_ENV,
  isProduction,
  hasCustomSecret: process.env.SESSION_SECRET !== undefined,
  secretLength: sessionSecret.length,
  cookieSecure: isProduction,
});

export const sessionConfig = {
  password: sessionSecret,
  cookieName: 'photo-album-session',
  cookieOptions: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    sameSite: 'lax' as const, // Add explicit sameSite policy
    path: '/', // Explicit path
  },
};

export async function getSession() {
  // Validate SESSION_SECRET on first runtime use in production
  if (isProduction && !hasValidatedSecret) {
    if (!process.env.SESSION_SECRET) {
      throw new Error(
        '[SECURITY ERROR] SESSION_SECRET environment variable is required in production. ' +
        'Please set SESSION_SECRET to a secure random string of at least 32 characters.'
      );
    }

    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error(
        `[SECURITY ERROR] SESSION_SECRET must be at least 32 characters long in production. ` +
        `Current length: ${process.env.SESSION_SECRET.length} characters.`
      );
    }
    hasValidatedSecret = true;
    console.log('[getSession] SESSION_SECRET validated successfully');
  }

  const cookieStore = await cookies();

  console.log('[getSession] Retrieving session with config:', {
    cookieName: sessionConfig.cookieName,
    secure: sessionConfig.cookieOptions.secure,
    httpOnly: sessionConfig.cookieOptions.httpOnly,
    NODE_ENV: process.env.NODE_ENV,
    hasSessionSecret: !!process.env.SESSION_SECRET,
  });

  const session = await getIronSession<SessionData>(cookieStore, sessionConfig);

  console.log('[getSession] Session retrieved:', {
    isAuthenticated: session.isAuthenticated,
    isAdmin: session.isAdmin,
    hasAccessKey: !!session.accessKey,
    sessionKeys: Object.keys(session),
  });

  return session;
}

export function generateAccessKey(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export async function validateSession(request: NextRequest): Promise<SessionData> {
  const response = NextResponse.next();
  const session = await getSessionFromRequest(request, response);
  return session;
}

/**
 * Get session from request/response directly (more reliable for API routes)
 * This mirrors how the middleware reads sessions
 */
export async function getSessionFromRequest(request: NextRequest, response: NextResponse) {
  // Validate SESSION_SECRET on first runtime use in production
  if (isProduction && !hasValidatedSecret) {
    if (!process.env.SESSION_SECRET) {
      throw new Error(
        '[SECURITY ERROR] SESSION_SECRET environment variable is required in production.'
      );
    }
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error(
        `[SECURITY ERROR] SESSION_SECRET must be at least 32 characters long in production.`
      );
    }
    hasValidatedSecret = true;
  }

  return await getIronSession<SessionData>(request, response, sessionConfig);
}