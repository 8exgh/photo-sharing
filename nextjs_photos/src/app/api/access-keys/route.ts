import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAccessKey, getAccessKeys, deleteAccessKey } from '@/lib/access-keys';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  console.log('[GET /api/access-keys] Request received');
  
  try {
    console.log('[GET /api/access-keys] Getting session...');
    const session = await getSession();
    console.log('[GET /api/access-keys] Session:', {
      isAuthenticated: session.isAuthenticated,
      isAdmin: session.isAdmin,
      accessKey: session.accessKey ? 'present' : 'none'
    });
    
    if (!session.isAdmin) {
      console.log('[GET /api/access-keys] Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[GET /api/access-keys] Fetching access keys...');
    const keys = await getAccessKeys();
    console.log('[GET /api/access-keys] Found', keys.length, 'keys');
    
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[GET /api/access-keys] Error:', error);
    console.error('[GET /api/access-keys] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  console.log('[POST /api/access-keys] Request received');
  
  try {
    console.log('[POST /api/access-keys] Getting session...');
    const session = await getSession();
    console.log('[POST /api/access-keys] Session:', {
      isAuthenticated: session.isAuthenticated,
      isAdmin: session.isAdmin,
      accessKey: session.accessKey ? 'present' : 'none'
    });
    
    if (!session.isAdmin) {
      console.log('[POST /api/access-keys] Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[POST /api/access-keys] Parsing request body...');
    const body = await request.json();
    console.log('[POST /api/access-keys] Request body:', body);
    
    const { expires } = body;
    console.log('[POST /api/access-keys] Creating access key with expires:', expires);
    
    const key = await createAccessKey(expires);
    console.log('[POST /api/access-keys] Access key created successfully:', key);
    
    return NextResponse.json({ key });
  } catch (error) {
    console.error('[POST /api/access-keys] Error:', error);
    console.error('[POST /api/access-keys] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[DELETE /api/access-keys] Request received');
  
  try {
    console.log('[DELETE /api/access-keys] Getting session...');
    const session = await getSession();
    console.log('[DELETE /api/access-keys] Session:', {
      isAuthenticated: session.isAuthenticated,
      isAdmin: session.isAdmin,
      accessKey: session.accessKey ? 'present' : 'none'
    });
    
    if (!session.isAdmin) {
      console.log('[DELETE /api/access-keys] Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[DELETE /api/access-keys] Parsing request body...');
    const body = await request.json();
    console.log('[DELETE /api/access-keys] Request body:', body);
    
    const { key } = body;
    
    if (!key) {
      console.log('[DELETE /api/access-keys] No key provided');
      return NextResponse.json({ error: 'Access key is required' }, { status: 400 });
    }
    
    console.log('[DELETE /api/access-keys] Deleting key:', key);
    const deleted = await deleteAccessKey(key);
    console.log('[DELETE /api/access-keys] Delete result:', deleted);
    
    if (!deleted) {
      console.log('[DELETE /api/access-keys] Key not found');
      return NextResponse.json({ error: 'Access key not found' }, { status: 404 });
    }
    
    console.log('[DELETE /api/access-keys] Key deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/access-keys] Error:', error);
    console.error('[DELETE /api/access-keys] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}