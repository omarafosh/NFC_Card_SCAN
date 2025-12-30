import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, role, branch_id, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { username, password, role, branch_id } = await request.json();

        if (!username || !password || !role) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('users')
            .insert([{
                username,
                password_hash,
                role,
                branch_id: branch_id || null
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ message: 'Username already exists' }, { status: 400 });
            }
            throw error;
        }

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (id === session.id.toString()) {
        return NextResponse.json({ message: 'Cannot delete yourself' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ message: 'User deleted' });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
