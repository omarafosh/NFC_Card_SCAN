import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const [rows] = await pool.query(`
            SELECT t.*, c.full_name as customer_name, d.name as discount_name
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN discounts d ON t.discount_id = d.id
            ORDER BY t.created_at DESC
            LIMIT 50
        `);
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}
