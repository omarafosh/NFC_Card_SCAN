import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const [rows] = await pool.query('SELECT * FROM discounts ORDER BY created_at DESC');
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
        const { name, type, value, points_required, start_date, end_date } = body;

        if (!name || !value) return NextResponse.json({ message: 'Name and Value are required' }, { status: 400 });

        await pool.query(
            'INSERT INTO discounts (name, type, value, points_required, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
            [name, type, value, points_required || 0, start_date || null, end_date || null]
        );

        return NextResponse.json({ message: 'Discount created' }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}
