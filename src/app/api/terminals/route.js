import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';
import crypto from 'crypto';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const branchId = url.searchParams.get('branch_id');

        let query = supabase
            .from('terminals')
            .select('*')
            .eq('is_active', true);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query.order('name', { ascending: true });
        if (error) throw error;

        return successResponse(data);
    } catch (error) {
        return handleApiError(error, 'GET /api/terminals');
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { branch_id, name, connection_url } = body;

        // Generate a secure secret for push-based ingestion
        const terminal_secret = crypto.randomBytes(32).toString('hex');

        const { data, error } = await supabase
            .from('terminals')
            .insert([
                { branch_id, name, connection_url, terminal_secret }
            ])
            .select()
            .single();

        if (error) throw error;

        return successResponse(data, 201, 'Terminal registered successfully');
    } catch (error) {
        return handleApiError(error, 'POST /api/terminals');
    }
}

export async function DELETE(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        // Soft delete (set is_active to false)
        const { error } = await supabase
            .from('terminals')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'Terminal deactivated successfully');
    } catch (error) {
        return handleApiError(error, 'DELETE /api/terminals');
    }
}
