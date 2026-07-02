import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase.rpc('revoke_session', { p_session_id: sessionId });
    
    if (error) {
      console.error('Error revoking session:', error);
      return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Internal server error in DELETE /sessions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
