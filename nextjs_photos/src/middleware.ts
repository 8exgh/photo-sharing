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
      
      // If a key is present in the URL, create a session
      // Validation will happen in the API routes
      const urlKey = searchParams.get('key');
      console.log('[Middleware] URL key:', urlKey, 'Path:', pathname);
      
      if (urlKey) {
        console.log('[Middleware] Creating session with key:', urlKey);
        // Create session with the key and redirect to clean URL
        session.isAuthenticated = true;
        session.accessKey = urlKey;
        session.isAdmin = false; // Access via key is always non-admin
        await session.save();

        const url = new URL(request.url);
        url.searchParams.delete('key');
        console.log('[Middleware] Redirecting to clean URL:', url.toString());
        
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
      console.log('[Middleware] Session auth status:', session.isAuthenticated, 'Admin:', session.isAdmin, 'Key:', session.accessKey);
      if (session.isAuthenticated) {
        console.log('[Middleware] Session authenticated, allowing access');
        return response;
      }

      // Not authenticated: no session exists
      // Access will be denied below
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
