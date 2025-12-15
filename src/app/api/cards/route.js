import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const [rows] = await pool.query(`
            SELECT cards.*, customers.full_name as customer_name 
            FROM cards 
            LEFT JOIN customers ON cards.customer_id = customers.id 
            ORDER BY cards.created_at DESC
        `);
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
        const { uid, customer_id } = body;

        if (!uid) return NextResponse.json({ message: 'UID is required' }, { status: 400 });

        // simple check if uid exists
        const [existing] = await pool.query('SELECT id FROM cards WHERE uid = ?', [uid]);
        if (existing.length > 0) {
            return NextResponse.json({ message: 'Card UID already registered' }, { status: 400 });
        }

        await pool.query(
            'INSERT INTO cards (uid, customer_id, is_active) VALUES (?, ?, ?)',
            [uid, customer_id || null, true]
        );

        return NextResponse.json({ message: 'Card registered' }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}
