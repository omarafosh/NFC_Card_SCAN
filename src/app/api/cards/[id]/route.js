import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { handleApiError, successResponse } from '@/lib/errorHandler';

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    try {
        const body = await request.json();
        const { customer_id, is_active } = body;

        const { error } = await supabase
            .from('cards')
            .update({ customer_id: customer_id || null, is_active })
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'Card updated');
    } catch (error) {
        return handleApiError(error, 'PUT /api/cards/[id]');
    }
}

export async function DELETE(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    try {
        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'Card deleted');
    } catch (error) {
        return handleApiError(error, 'DELETE /api/cards/[id]');
    }
}
