import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData } from '@/types';
import { getClientIP, log } from '@/lib/logger';

const isProduction = process.env.NODE_ENV === 'production';
const cookieSecure = process.env.COOKIE_SECURE !== undefined
  ? process.env.COOKIE_SECURE !== 'false'
  : isProduction;

// Use sessionSecret without validation at module level (for build compatibility)
const sessionSecret = process.env.SESSION_SECRET || 'change-this-to-a-secure-secret-key-at-least-32-characters-long';

// Track if we've validated the secret (only validate once per runtime)
let hasValidatedSecret = false;

// Function to validate SESSION_SECRET at runtime
function validateSessionSecret() {
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
    log('Middleware', 'SESSION_SECRET validated successfully');
  }
}

log('Middleware', 'Session config initialized', {
  environment: process.env.NODE_ENV,
  isProduction,
  hasCustomSecret: process.env.SESSION_SECRET !== undefined,
  secretLength: sessionSecret.length,
  cookieSecure,
});

const sessionConfig = {
  password: sessionSecret,
  cookieName: 'photo-album-session',
  cookieOptions: {
    secure: cookieSecure,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    sameSite: 'lax' as const,
    path: '/',
  },
};

export async function middleware(request: NextRequest) {
  // Validate SESSION_SECRET on first request in production
  validateSessionSecret();

  const { pathname, searchParams } = request.nextUrl;

  // Protect /albums routes
  if (pathname.startsWith('/albums')) {
    try {
      const response = NextResponse.next();
      // Use consistent cookie settings based on environment
      const session = await getIronSession<SessionData>(request, response, sessionConfig);
      
      // If a key is present in the URL, create a session
      // Validation will happen in the API routes
      const urlKey = searchParams.get('key');
      const ip = getClientIP(request);
      log('Middleware', 'Processing albums route', { ip, pathname, hasUrlKey: !!urlKey });

      if (urlKey) {
        log('Middleware', 'Creating session with access key', { ip, keyPrefix: urlKey.substring(0, 8) + '...' });
        // Create session with the key and redirect to clean URL
        session.isAuthenticated = true;
        session.accessKey = urlKey;
        session.isAdmin = false; // Access via key is always non-admin
        await session.save();

        const url = new URL(request.url);
        url.searchParams.delete('key');
        log('Middleware', 'Redirecting to clean URL', { ip, cleanUrl: url.pathname });
        
        // Create a redirect response and ensure session is properly attached
        const redirectResponse = NextResponse.redirect(url);
        
        // Apply the session cookie to the redirect response
        const cookieHeader = response.headers.get('set-cookie');
        if (cookieHeader) {
          redirectResponse.headers.set('set-cookie', cookieHeader);
        }
        
        return redirectResponse;
      }
      
      // If already authenticated, allow access
      // Validation will happen in the API routes
      log('Middleware', 'Session status check', { ip, isAuth: session.isAuthenticated, isAdmin: session.isAdmin, hasKey: !!session.accessKey });
      if (session.isAuthenticated) {
        log('Middleware', 'Session authenticated, allowing access', { ip, pathname });
        return response;
      }

      // Not authenticated: no session exists
      // Access will be denied below
      log('Middleware', 'No valid session, access denied', { ip, pathname });
    } catch (_error) {
      const ip = getClientIP(request);
      log('Middleware', 'Session error, redirecting to access-denied', { ip, pathname, error: _error instanceof Error ? _error.message : String(_error) });
      // Clear any existing session on error
      try {
        // session may not be available here; attempt to reset via cookie deletion by redirecting
        return NextResponse.redirect(new URL('/access-denied', request.url));
      } catch (_saveError) {
        // Ignore save errors
      }
    }

    // Redirect to access denied if no valid session or key
    const ip = getClientIP(request);
    log('Middleware', 'Redirecting to access-denied', { ip, pathname });
    return NextResponse.redirect(new URL('/access-denied', request.url));
  }
  
  // Protect /admin routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const ip = getClientIP(request);
    log('Middleware', 'Admin route access attempt', { ip, pathname });
    try {
      const response = NextResponse.next();
      // Use consistent cookie settings based on environment
      const session = await getIronSession<SessionData>(request, response, sessionConfig);

      if (!session.isAdmin) {
        log('Middleware', 'Admin access denied, not admin', { ip, pathname, isAuth: session.isAuthenticated });
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
      log('Middleware', 'Admin access granted', { ip, pathname });
    } catch (_error) {
      log('Middleware', 'Admin session error', { ip, pathname, error: _error instanceof Error ? _error.message : String(_error) });
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/albums/:path*', '/admin/:path*'],
};
