import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';
import { successResponse, handleApiError } from '@/lib/errorHandler';

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
        let query = supabase
            .from('transactions')
            .select(`
                *,
                customers (full_name),
                discounts (name)
            `);

        if (customerId) {
            query = query.eq('customer_id', customerId);
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const rows = data.map(t => ({
            ...t,
            customer_name: t.customers?.full_name || null,
            discount_name: t.discounts?.name || null
        }));

        return successResponse(rows);
    } catch (error) {
        return handleApiError(error, 'GET /api/transactions');
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
        const {
            customer_id,
            card_id,
            discount_id,
            amount,
            manual_discount = 0,
            manual_discount_type = 'percentage',
            payment_method = 'CASH',
            is_topup = false
        } = body;

        // --- NEW: Wallet Top-up Handler ---
        if (is_topup) {
            const { topUp } = await import('@/lib/wallet');
            const newBalance = await topUp(customer_id, amount, session.id);
            const { data: updatedCust } = await supabase.from('customers').select('*').eq('id', customer_id).single();
            return successResponse({
                status: 'success',
                message: 'Wallet recharged successfully',
                new_balance: newBalance,
                updated_customer: updatedCust
            }, 201);
        }

        let amount_after = parseFloat(amount) || 0;
        let discount = null;
        let points_to_deduct = 0;

        // 1. Validate & Apply Loyalty Discount (Reward)
        if (discount_id) {
            const { data: discountData, error: discountErr } = await supabase
                .from('discounts')
                .select('*')
                .eq('id', discount_id)
                .single();

            if (discountErr) throw discountErr;

            if (discountData) {
                discount = discountData;

                // Verify points
                if (discount.points_required > 0) {
                    const { data: cust, error: custErr } = await supabase
                        .from('customers')
                        .select('points_balance')
                        .eq('id', customer_id)
                        .single();

                    if (custErr) throw custErr;

                    if (cust.points_balance < discount.points_required) {
                        return NextResponse.json({ message: 'Insufficient points for this reward' }, { status: 400 });
                    }
                    points_to_deduct = discount.points_required;
                }

                // Calculate Loyalty Discount
                if (discount.type === 'percentage') {
                    amount_after = amount_after - (amount_after * (discount.value / 100));
                } else if (discount.type === 'fixed_amount') {
                    amount_after = amount_after - discount.value;
                }
            }
        }

        // 2. Apply Manual Discount (Expert Rule: Applied after loyalty)
        const manVal = parseFloat(manual_discount) || 0;
        if (manVal > 0) {
            if (manual_discount_type === 'percentage') {
                amount_after = amount_after - (amount_after * (manVal / 100));
            } else {
                amount_after = amount_after - manVal;
            }
        }

        if (amount_after < 0) amount_after = 0;

        // --- NEW: Wallet Payment Handler ---
        if (payment_method === 'WALLET') {
            const { getBalance } = await import('@/lib/wallet');
            const balance = await getBalance(customer_id);
            if (balance < amount_after) {
                return NextResponse.json({ message: 'Insufficient wallet balance' }, { status: 400 });
            }
        }

        // 2. Calculate Points Earned
        const { calculatePoints, logPoints } = await import('@/lib/loyalty');
        const points_earned = await calculatePoints(amount_after);

        // 3. Create Transaction
        const { data: transaction, error: transError } = await supabase
            .from('transactions')
            .insert([
                {
                    customer_id,
                    card_id,
                    discount_id: discount_id || null,
                    amount_before: amount,
                    amount_after,
                    points_earned,
                    payment_method,
                    status: 'success'
                }
            ])
            .select()
            .single();

        if (transError) throw transError;
        const transaction_id = transaction.id;

        // --- NEW: Wallet Deduction ---
        if (payment_method === 'WALLET') {
            const { payWithWallet } = await import('@/lib/wallet');
            await payWithWallet(customer_id, amount_after, transaction_id, session.id);
        }

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
                admin_id: session.id
            });
        }

        // 5. Get Updated Customer Data
        const { data: updatedCustomer, error: updateCustErr } = await supabase
            .from('customers')
            .select('points_balance, balance')
            .eq('id', customer_id)
            .single();

        return successResponse({
            status: 'success',
            transaction_id,
            points_earned,
            amount_after,
            updated_customer: updatedCustomer || null
        }, 201);

    } catch (error) {
        return handleApiError(error, 'POST /api/transactions');
    }
}
export async function DELETE(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { error } = await supabase.from('transactions').delete().neq('id', 0); // Delete all
        if (error) throw error;
        return successResponse({ message: 'Audit trail cleared' });
    } catch (error) {
        return handleApiError(error, 'DELETE /api/transactions');
    }
}
