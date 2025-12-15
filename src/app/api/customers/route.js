import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { customerSchema } from '@/lib/schemas';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';

    let query = 'SELECT * FROM customers ORDER BY created_at DESC';
    let params = [];

    if (search) {
        query = 'SELECT * FROM customers WHERE full_name LIKE ? OR phone LIKE ? ORDER BY created_at DESC';
        params = [`%${search}%`, `%${search}%`];
    }

    try {
        const [rows] = await pool.query(query, params);
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();

        // Validate input
        const validation = customerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({
                message: 'Invalid input',
                errors: validation.error.flatten().fieldErrors
            }, { status: 400 });
        }

        const { full_name, phone, email } = validation.data;

        const [result] = await pool.query(
            'INSERT INTO customers (full_name, phone, email) VALUES (?, ?, ?)',
            [full_name, phone, email]
        );

        return NextResponse.json({ id: result.insertId, full_name, phone, email }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}
