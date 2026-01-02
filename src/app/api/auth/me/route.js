import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Fetch latest data from database to include two_factor_enabled
    const { data: user, error } = await supabase
        .from('users')
        .select('id, username, role, two_factor_enabled, branch_id')
        .eq('id', session.id)
        .single();

    if (error || !user) {
        return NextResponse.json({ message: 'User session invalid' }, { status: 401 });
    }

    return NextResponse.json({ user });
}
