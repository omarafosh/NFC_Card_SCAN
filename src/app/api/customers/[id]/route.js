import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    try {
        const body = await request.json();
        const { full_name, phone, email } = body;

        await pool.query(
            'UPDATE customers SET full_name = ?, phone = ?, email = ? WHERE id = ?',
            [full_name, phone, email, id]
        );

        return NextResponse.json({ message: 'Customer updated' });
    } catch (error) {
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    try {
        await pool.query('DELETE FROM customers WHERE id = ?', [id]);
        return NextResponse.json({ message: 'Customer deleted' });
    } catch (error) {
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}
