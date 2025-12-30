import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    try {
        const body = await request.json();
        const { full_name, phone, email } = body;

        const { error } = await supabase
            .from('customers')
            .update({ full_name, phone, email })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ message: 'Customer updated' });
    } catch (error) {
        console.error('PUT /api/customers/[id] error:', error);
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    try {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ message: 'Customer deleted' });
    } catch (error) {
        console.error('DELETE /api/customers/[id] error:', error);
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}
