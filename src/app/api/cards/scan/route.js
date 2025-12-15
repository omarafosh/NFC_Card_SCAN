import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { uid } = body;

        if (!uid) return NextResponse.json({ message: 'UID is required' }, { status: 400 });

        // 1. Find Card & Customer
        const [cards] = await pool.query(`
            SELECT c.*, cust.full_name, cust.points_balance, cust.id as customer_id
            FROM cards c
            JOIN customers cust ON c.customer_id = cust.id
            WHERE c.uid = ? AND c.is_active = 1
        `, [uid]);

        if (cards.length === 0) {
            return NextResponse.json({ success: false, message: 'Card not found or inactive' }, { status: 404 });
        }

        const card = cards[0];

        // 2. Find Best Active Discount (Simple logic: highest value percentage)
        // In real app, this might be complex rules.
        const [discounts] = await pool.query(`
            SELECT * FROM discounts 
            WHERE is_active = 1 
            ORDER BY value DESC 
            LIMIT 1
        `);

        let appliedDiscount = null;
        if (discounts.length > 0) {
            appliedDiscount = discounts[0];
        }

        // 3. Log Transaction
        await pool.query(
            'INSERT INTO transactions (customer_id, card_id, discount_id, status) VALUES (?, ?, ?, ?)',
            [card.customer_id, card.id, appliedDiscount ? appliedDiscount.id : null, 'success']
        );

        // 4. Update points (e.g., +10 points per scan)
        await pool.query('UPDATE customers SET points_balance = points_balance + 10 WHERE id = ?', [card.customer_id]);

        return NextResponse.json({
            success: true,
            customer: {
                name: card.full_name,
                points: card.points_balance + 10 // optimistically active
            },
            discount: appliedDiscount,
            message: 'Scan successful'
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, message: 'System error' }, { status: 500 });
    }
}
