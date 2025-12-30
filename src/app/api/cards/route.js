import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError, createdResponse } from '@/lib/errorHandler';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await supabase
            .from('cards')
            .select(`
                *,
                customers (
                    full_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map for frontend compatibility
        const rows = data.map(card => ({
            ...card,
            customer_name: card.customers?.full_name || null
        }));

        return successResponse(rows);
    } catch (error) {
        return handleApiError(error, 'GET /api/cards');
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { uid, customer_id } = body;

        if (!uid) return NextResponse.json({ message: 'UID is required' }, { status: 400 });

        // Check if UID exists using Supabase
        const { data: existing } = await supabase
            .from('cards')
            .select('id')
            .eq('uid', uid)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ message: 'Card UID already registered' }, { status: 400 });
        }

        const { error } = await supabase
            .from('cards')
            .insert([
                { uid, customer_id: customer_id || null, is_active: true }
            ]);

        if (error) throw error;

        return createdResponse({ uid, customer_id }, 'Card registered successfully');
    } catch (error) {
        return handleApiError(error, 'POST /api/cards');
    }
}
