import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
        const { data: card, error: cardError } = await supabase
            .from('cards')
            .select('*')
            .eq('uid', uid)
            .eq('is_active', true)
            .maybeSingle();

        if (cardError) throw cardError;

        if (!card) {
            return NextResponse.json({
                status: 'unknown_card',
                message: 'Card not registered',
                uid
            });
        }

        // 2. Find the customer
        const { data: customer, error: custError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', card.customer_id)
            .single();

        if (custError) throw custError;

        if (!customer) {
            return NextResponse.json({
                status: 'error',
                message: 'Card is assigned to a missing customer'
            });
        }

        // 3. Find applicable/available discounts (Rewards)
        const now = new Date().toISOString();

        let discountQuery = supabase
            .from('discounts')
            .select('*')
            .eq('is_active', true)
            .lte('points_required', customer.points_balance || 0);

        // Filter by date (Complex filters might need raw SQL or careful chaining)
        const { data: discounts, error: discError } = await discountQuery
            .order('points_required', { ascending: false });

        if (discError) throw discError;

        // Note: Filter dates in JS for simplicity or use raw SQL if needed.
        // For project scale, JS filtering for dates is fine.
        const availableRewards = discounts.filter(d => {
            const startOk = !d.start_date || d.start_date <= now;
            const endOk = !d.end_date || d.end_date >= now;
            return startOk && endOk;
        });

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
