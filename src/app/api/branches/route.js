import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabase
            .from('branches')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;

        return successResponse(data);
    } catch (error) {
        return handleApiError(error, 'GET /api/branches');
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, location } = body;

        if (!name) return NextResponse.json({ message: 'Name is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('branches')
            .insert([{ name, location, is_active: true }])
            .select()
            .single();

        if (error) throw error;

        return successResponse(data, 201, 'Branch created successfully');
    } catch (error) {
        return handleApiError(error, 'POST /api/branches');
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
            .from('branches')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'Branch deactivated successfully');
    } catch (error) {
        return handleApiError(error, 'DELETE /api/branches');
    }
}
