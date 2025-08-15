import { getIronSession } from 'iron-session';
import { SessionData } from '@/types';
import { cookies } from 'next/headers';

export const sessionConfig = {
  password: process.env.SESSION_SECRET || 'change-this-to-a-secure-secret-key-at-least-32-characters-long',
  cookieName: 'photo-album-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionConfig);
}

export function generateAccessKey(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export async function validateSession(_request?: Request): Promise<SessionData> {
  const session = await getSession();
  return session;
}