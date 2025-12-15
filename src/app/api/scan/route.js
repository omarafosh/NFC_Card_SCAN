import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const { uid } = await request.json();

        if (!uid) return NextResponse.json({ message: 'UID is required' }, { status: 400 });

        // 1. Find the card
        const [cards] = await pool.query('SELECT * FROM cards WHERE uid = ? AND is_active = 1', [uid]);

        if (cards.length === 0) {
            return NextResponse.json({
                status: 'unknown_card',
                message: 'Card not registered',
                uid
            });
        }

        const card = cards[0];

        // 2. Find the customer
        const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [card.customer_id]);
        if (customers.length === 0) {
            return NextResponse.json({
                status: 'error',
                message: 'Card is assigned to a missing customer'
            });
        }
        const customer = customers[0];

        // 3. Find applicable discount (mock logic for now - get first active discount)
        // In a real app, logic would be complex (points based, etc.)
        const [discounts] = await pool.query('SELECT * FROM discounts WHERE is_active = 1 LIMIT 1');
        const discount = discounts.length > 0 ? discounts[0] : null;

        return NextResponse.json({
            status: 'success',
            customer,
            card,
            discount
        });

    } catch (error) {
        console.error('Scan API Error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
