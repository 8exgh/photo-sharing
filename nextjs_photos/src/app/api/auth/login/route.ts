import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('[POST /api/auth/login] Login attempt:', {
      timestamp: new Date().toISOString(),
      headers: {
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        cookie: request.headers.get('cookie')?.substring(0, 50) + '...',
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasAdminPassword: !!process.env.ADMIN_PASSWORD,
        hasSessionSecret: !!process.env.SESSION_SECRET,
      }
    });
    
    const { password } = await request.json();
    
    // Simple admin password check (in production, use proper authentication)
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password === adminPassword) {
      console.log('[POST /api/auth/login] Password correct, creating admin session');
      
      const session = await getSession();
      session.isAuthenticated = true;
      session.isAdmin = true;
      await session.save();
      
      console.log('[POST /api/auth/login] Admin session created successfully:', {
        isAuthenticated: session.isAuthenticated,
        isAdmin: session.isAdmin,
        sessionKeys: Object.keys(session),
      });
      
      return NextResponse.json({ success: true });
    }
    
    console.log('[POST /api/auth/login] Invalid password attempt');
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    console.error('[POST /api/auth/login] Login error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}