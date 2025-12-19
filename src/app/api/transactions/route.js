import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Apply rate limiting
    const rateLimit = await rateLimitMiddleware(RATE_LIMITS.READ)(request, '/api/transactions');
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: rateLimit.message },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': RATE_LIMITS.READ.maxAttempts.toString(),
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': rateLimit.resetAt.toISOString()
                }
            }
        );
    }

    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer_id');

    try {
        let query = `
            SELECT t.*, c.full_name as customer_name, d.name as discount_name
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN discounts d ON t.discount_id = d.id
        `;
        const params = [];

        if (customerId) {
            query += ' WHERE t.customer_id = ?';
            params.push(customerId);
        }

        query += ' ORDER BY t.created_at DESC LIMIT 50';

        const [rows] = await pool.query(query, params);
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ message: 'Database error' }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Apply rate limiting
    const rateLimit = await rateLimitMiddleware(RATE_LIMITS.API)(request, '/api/transactions');
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: rateLimit.message },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': RATE_LIMITS.API.maxAttempts.toString(),
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': rateLimit.resetAt.toISOString()
                }
            }
        );
    }

    try {
        const body = await request.json();
        const { customer_id, card_id, discount_id, amount } = body;

        let amount_after = parseFloat(amount) || 0;
        let discount = null;
        let points_to_deduct = 0;

        // 1. Validate & Apply Discount
        if (discount_id) {
            const [discounts] = await pool.query('SELECT * FROM discounts WHERE id = ?', [discount_id]);
            if (discounts.length > 0) {
                discount = discounts[0];

                // Verify points
                if (discount.points_required > 0) {
                    const [cust] = await pool.query('SELECT points_balance FROM customers WHERE id = ?', [customer_id]);
                    if (cust[0].points_balance < discount.points_required) {
                        return NextResponse.json({ message: 'Insufficient points for this reward' }, { status: 400 });
                    }
                    points_to_deduct = discount.points_required;
                }

                // Calculate Discount
                if (discount.type === 'percentage') {
                    amount_after = amount_after - (amount_after * (discount.value / 100));
                } else if (discount.type === 'fixed_amount') {
                    amount_after = amount_after - discount.value;
                }
                if (amount_after < 0) amount_after = 0;
            }
        }

        // 2. Calculate Points Earned
        const { calculatePoints, logPoints } = await import('@/lib/loyalty');
        const points_earned = await calculatePoints(amount_after);

        // 3. Create Transaction
        const [result] = await pool.query(
            `INSERT INTO transactions 
            (customer_id, card_id, discount_id, amount_before, amount_after, points_earned, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'success')`,
            [customer_id, card_id, discount_id || null, amount, amount_after, points_earned]
        );
        const transaction_id = result.insertId;

        // 4. Log Points
        // A. Deduction (Redemption)
        if (points_to_deduct > 0) {
            await logPoints({
                customer_id,
                points: -points_to_deduct,
                reason: `Redeemed Reward: ${discount.name}`,
                transaction_id,
                admin_id: session.id
            });
        }

        // B. Earning
        if (points_earned > 0) {
            await logPoints({
                customer_id,
                points: points_earned,
                reason: 'Purchase Reward',
                transaction_id,
                admin_id: session.id // technically system/cashier
            });
        }

        return NextResponse.json({
            status: 'success',
            transaction_id,
            points_earned,
            amount_after
        });

    } catch (error) {
        console.error('Transaction Error:', error);
        return NextResponse.json({ message: 'Transaction failed' }, { status: 500 });
    }
}
