import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Apply rate limiting - use API limits for scan operations
    const rateLimit = await rateLimitMiddleware(RATE_LIMITS.API)(request, '/api/scan');
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

        // 3. Find applicable/available discounts (Rewards)
        // Check for active discounts where the user has enough points
        const [discounts] = await pool.query(`
            SELECT * FROM discounts 
            WHERE is_active = 1 
            AND (start_date IS NULL OR start_date <= NOW())
            AND (end_date IS NULL OR end_date >= NOW())
            AND (points_required = 0 OR points_required <= ?)
            ORDER BY points_required DESC
        `, [customer.points_balance]);

        // We can return the "Best" discount or a list. For now, let's return all available.
        // Or if the logic is "Apply best automatic discount", we pick one. 
        // Typically, rewards are "Available to redeem".

        // Let's pass the full list of available rewards to the frontend
        const availableRewards = discounts;

        // Fetch user's stats or last visit could be added here

        return NextResponse.json({
            status: 'success',
            customer,
            card,
            availableRewards
        });

    } catch (error) {
        console.error('Scan API Error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
