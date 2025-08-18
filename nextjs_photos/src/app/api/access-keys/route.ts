import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAccessKey, getAccessKeys, deleteAccessKey } from '@/lib/access-keys';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const keys = await getAccessKeys();
    return NextResponse.json({ keys });
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { expires } = await request.json();
    const key = await createAccessKey(expires);
    
    return NextResponse.json({ key });
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { key } = await request.json();
    
    if (!key) {
      return NextResponse.json({ error: 'Access key is required' }, { status: 400 });
    }
    
    const deleted = await deleteAccessKey(key);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Access key not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}