import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError, createdResponse } from '@/lib/errorHandler';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const showDeleted = searchParams.get('deleted') === 'true';

        let query = supabase
            .from('cards')
            .select(`
                *,
                customers (
                    full_name
                )
            `);

        if (showDeleted) {
            query = query.not('deleted_at', 'is', null);
        } else {
            query = query.is('deleted_at', null);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

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

import { logAudit } from '@/lib/audit';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { uid, customer_id, expires_at } = body;

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

        // Default expiration: 3 months from now if not provided
        const defaultExpiration = new Date();
        defaultExpiration.setMonth(defaultExpiration.getMonth() + 3);
        const finalExpiresAt = expires_at || defaultExpiration.toISOString();

        const { data: newCard, error } = await supabase
            .from('cards')
            .insert([
                {
                    uid,
                    customer_id: customer_id || null,
                    is_active: true,
                    expires_at: finalExpiresAt
                }
            ])
            .select()
            .single();

        if (error) throw error;

        await logAudit({
            action: 'CREATE',
            entity: 'cards',
            entityId: newCard.id,
            details: { uid, customer_id },
            req: request
        });

        return createdResponse({ uid, customer_id }, 'Card registered successfully');
    } catch (error) {
        return handleApiError(error, 'POST /api/cards');
    }
}

export async function PATCH(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, restore } = await request.json();
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        if (restore) {
            const { error } = await supabase
                .from('cards')
                .update({
                    deleted_at: null,
                    is_active: true
                })
                .eq('id', id);

            if (error) throw error;

            await logAudit({
                action: 'RESTORE',
                entity: 'cards',
                entityId: id,
                details: { restored_at: new Date().toISOString() },
                req: request
            });

            return successResponse({ id }, 200, 'Card restored successfully');
        }

        return NextResponse.json({ message: 'No action taken' });
    } catch (error) {
        return handleApiError(error, 'PATCH /api/cards');
    }
}

