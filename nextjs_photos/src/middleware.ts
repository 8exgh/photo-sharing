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
      
      // Allow authenticated sessions (admin or with access key) to proceed
      // Actual validation will happen in API routes
      if (session.isAuthenticated) {
        return response;
      }
      
      // Check for access key in URL and create session
      // Validation will happen in API routes
      const accessKey = searchParams.get('key');
      if (accessKey) {
        // Create session with the key and redirect to clean URL
        session.isAuthenticated = true;
        session.accessKey = accessKey;
        await session.save();
        
        const url = new URL(request.url);
        url.searchParams.delete('key');
        return NextResponse.redirect(url);
      }
    } catch (error) {
      // Clear any existing session on error
      try {
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
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