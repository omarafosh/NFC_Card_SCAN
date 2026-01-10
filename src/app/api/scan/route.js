import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';
import { enforceMaintenance } from '@/lib/maintenance';

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Enforce Maintenance Mode
    const maintenance = await enforceMaintenance(session);
    if (maintenance) return maintenance;

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
        // 1. Find the card using supabaseAdmin for reliable reading
        const { data: card, error: cardError } = await supabaseAdmin
            .from('cards')
            .select('*')
            .eq('uid', uid)
            .eq('is_active', true)
            .is('deleted_at', null)
            .maybeSingle();

        if (cardError) throw cardError;

        if (!card) {
            return NextResponse.json({
                status: 'unknown_card',
                message: 'Card not registered',
                uid
            });
        }

        // Check for expiration
        if (card.expires_at && new Date(card.expires_at) < new Date()) {
            return NextResponse.json({
                status: 'expired',
                message: 'Card has expired',
                card
            });
        }

        // Check availability (is_active) - already in query but double check for explicit message if needed
        if (!card.is_active) {
            return NextResponse.json({
                status: 'disconnected',
                message: 'Card is inactive'
            });
        }

        // 2. Find the customer
        const { data: customer, error: custError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', card.customer_id)
            .is('deleted_at', null)
            .maybeSingle();

        if (custError) throw custError;

        if (!customer) {
            return NextResponse.json({
                status: 'error',
                message: 'Customer not found or account is deactivated'
            });
        }

        // 3-8. Fetch all related data in PARALLEL for performance
        const now = new Date().toISOString();

        const [
            { data: discounts },
            { data: recentTransactions },
            { data: coupons },
            { data: campaignProgress },
            { data: manualCampaigns },
            { data: availableBundles }
        ] = await Promise.all([
            // 3. Discounts (Rewards)
            supabaseAdmin
                .from('discounts')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false }),

            // 4. Recent Transactions
            supabaseAdmin
                .from('transactions')
                .select('id, amount_after, created_at, discounts ( name )')
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false })
                .limit(3),

            // 5. Active Coupons (Include those with NO expiration date)
            supabaseAdmin
                .from('customer_coupons')
                .select('*, campaigns!inner(*)')
                .eq('customer_id', customer.id)
                .in('status', ['ACTIVE', 'active'])
                .eq('campaigns.is_active', true)
                .is('campaigns.deleted_at', null)
                .or(`expires_at.is.null,expires_at.gt.${now}`)
                .order('created_at', { ascending: false }),

            // 6. Campaign Progress
            supabaseAdmin
                .from('customer_campaign_progress')
                .select('*, campaigns(*)')
                .eq('customer_id', customer.id),

            // 7. Manual Campaigns
            supabaseAdmin
                .from('campaigns')
                .select('*')
                .eq('type', 'MANUAL')
                .eq('is_active', true)
                .is('deleted_at', null),

            // 8. Bundle Campaigns
            supabaseAdmin
                .from('campaigns')
                .select('*')
                .eq('type', 'BUNDLE')
                .eq('is_active', true)
                .is('deleted_at', null)
        ]);

        // Filter discounts logic (Steps 3 continued)
        const availableRewards = (discounts || []).filter(d => {
            const startOk = !d.start_date || d.start_date <= now;
            const endOk = !d.end_date || d.end_date >= now;
            return startOk && endOk;
        });

        // Step 9: Calculate Total Savings
        const { data: allTrans } = await supabase
            .from('transactions')
            .select('amount_before, amount_after')
            .eq('customer_id', customer.id)
            .eq('status', 'success');

        const total_savings = (allTrans || []).reduce((acc, t) => {
            const savings = parseFloat(t.amount_before || 0) - parseFloat(t.amount_after || 0);
            return acc + (savings > 0 ? savings : 0);
        }, 0);

        return NextResponse.json({
            status: 'success',
            customer,
            card,
            availableRewards,
            coupons: coupons || [],
            campaignProgress: campaignProgress || [],
            manualCampaigns: manualCampaigns || [],
            availableBundles: availableBundles || [],
            recentTransactions: recentTransactions || []
        });

    } catch (error) {
        console.error('Scan API Error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
