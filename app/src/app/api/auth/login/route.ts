import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { timingSafeEqual } from 'crypto';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

// Rate limiting
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         'unknown';
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/login';
  try {
    logRequest(TAG, request, { msg: 'Login attempt' });

    // Rate limiting check
    const ip = getClientIp(request);
    const now = Date.now();
    const attempts = loginAttempts.get(ip);

    if (attempts) {
      if (now > attempts.resetAt) {
        loginAttempts.delete(ip);
      } else if (attempts.count >= MAX_ATTEMPTS) {
        log(TAG, 'Rate limited', { ip });
        return NextResponse.json(
          { error: 'Too many login attempts. Try again later.' },
          { status: 429 }
        );
      }
    }

    const { password } = await request.json();

    // Simple admin password check (in production, use proper authentication)
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (safeCompare(password, adminPassword)) {
      log(TAG, 'Password correct, creating admin session');

      // Clear rate limit on success
      loginAttempts.delete(ip);

      const response = new NextResponse();
      const session = await getSessionFromRequest(request, response);
      session.isAuthenticated = true;
      session.isAdmin = true;
      await session.save();

      log(TAG, 'Admin session created successfully', { isAuthenticated: true, isAdmin: true });

      // Return with session cookie headers
      return new NextResponse(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
      });
    }

    // Track failed attempt
    const current = loginAttempts.get(ip);
    if (current && now <= current.resetAt) {
      current.count++;
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    }

    logRequest(TAG, request, { msg: 'Invalid password attempt' });
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    logError(TAG, 'Login error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
