import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData } from '@/types';

const sessionConfig = {
  password: process.env.SESSION_SECRET || 'change-this-to-a-secure-secret-key-at-least-32-characters-long',
  cookieName: 'photo-album-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // Protect /albums routes
  if (pathname.startsWith('/albums')) {
    try {
      const response = NextResponse.next();
      const session = await getIronSession<SessionData>(request, response, {
        ...sessionConfig,
        cookieOptions: {
          ...sessionConfig.cookieOptions,
          secure: false, // Allow for development
        },
      });
      
      // If a key is present in the URL, always validate it — even for admins.
      // This makes shared links behave like viewer-mode regardless of admin login state.
      const urlKey = searchParams.get('key');
      if (urlKey) {
        const validateUrl = new URL('/api/validate-key', request.url);
        const validateRes = await fetch(validateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: urlKey }),
          cache: 'no-store',
        });

        if (validateRes.status === 200) {
          // Establish or refresh a viewer session keyed by the provided access key
          session.isAuthenticated = true;
          session.accessKey = urlKey;
          // Do not alter admin flag here; this path enforces key validity when a key is provided
          await session.save();

          const url = new URL(request.url);
          url.searchParams.delete('key');
          return NextResponse.redirect(url);
        }

        // Key invalid -> deny access irrespective of admin state for this link form
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        return NextResponse.redirect(new URL('/access-denied', request.url));
      }
      
      // If already authenticated, validate non-admin access key on each request
      if (session.isAuthenticated) {
        if (session.isAdmin) {
          return response;
        }

        if (session.accessKey) {
          const validateUrl = new URL('/api/validate-key', request.url);
          const validateRes = await fetch(validateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: session.accessKey }),
            cache: 'no-store',
          });

          if (validateRes.status !== 200) {
            // Invalidate the session if key no longer valid
            session.isAuthenticated = false;
            session.accessKey = undefined;
            await session.save();
            return NextResponse.redirect(new URL('/access-denied', request.url));
          }

          return response;
        }

        // No admin flag and no access key: treat as unauthenticated
        session.isAuthenticated = false;
        await session.save();
      }

      // Not authenticated: check for access key in URL and validate before creating session
      const accessKey = searchParams.get('key');
      if (accessKey) {
        const validateUrl = new URL('/api/validate-key', request.url);
        const validateRes = await fetch(validateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: accessKey }),
          cache: 'no-store',
        });

        if (validateRes.status === 200) {
          // Valid key: create session and redirect to clean URL
          session.isAuthenticated = true;
          session.accessKey = accessKey;
          await session.save();

          const url = new URL(request.url);
          url.searchParams.delete('key');
          return NextResponse.redirect(url);
        }
      }
    } catch (error) {
      // Clear any existing session on error
      try {
        // session may not be available here; attempt to reset via cookie deletion by redirecting
        return NextResponse.redirect(new URL('/access-denied', request.url));
      } catch (_saveError) {
        // Ignore save errors
      }
    }
    
    // Redirect to access denied if no valid session or key
    return NextResponse.redirect(new URL('/access-denied', request.url));
  }
  
  // Protect /admin routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    try {
      const response = NextResponse.next();
      const session = await getIronSession<SessionData>(request, response, {
        ...sessionConfig,
        cookieOptions: {
          ...sessionConfig.cookieOptions,
          secure: false, // Allow for development
        },
      });
      
      if (!session.isAdmin) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    } catch (_error) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/albums/:path*', '/admin/:path*'],
};
