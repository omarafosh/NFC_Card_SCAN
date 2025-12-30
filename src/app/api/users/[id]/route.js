import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { handleApiError, successResponse } from '@/lib/errorHandler';

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    try {
        const body = await request.json();
        const { username, password, role, branch_id } = body;

        const updateData = {
            username,
            role,
            branch_id: branch_id || null
        };

        if (password) {
            updateData.password_hash = await bcrypt.hash(password, 10);
        }

        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;

        return successResponse({ id }, 200, 'User updated');
    } catch (error) {
        return handleApiError(error, 'PUT /api/users/[id]');
    }
}
