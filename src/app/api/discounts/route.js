import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await supabase
            .from('discounts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return successResponse(data);
    } catch (error) {
        return handleApiError(error, 'GET /api/discounts');
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { name, type, value, points_required, start_date, end_date } = body;

        if (!name || !value) return NextResponse.json({ message: 'Name and Value are required' }, { status: 400 });

        const { error } = await supabase
            .from('discounts')
            .insert([
                {
                    name,
                    type,
                    value,
                    points_required: points_required || 0,
                    start_date: start_date || null,
                    end_date: end_date || null,
                    is_active: true
                }
            ]);

        if (error) throw error;

        return successResponse(null, 201, 'Discount created successfully');
    } catch (error) {
        return handleApiError(error, 'POST /api/discounts');
    }
}
