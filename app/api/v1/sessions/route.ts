import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: sessions, error } = await supabase.rpc('get_active_sessions');
    
    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({ data: sessions });
  } catch (err) {
    console.error('Internal server error in GET /sessions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
