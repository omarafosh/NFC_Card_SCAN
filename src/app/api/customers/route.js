import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { customerSchema } from '@/lib/schemas';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';
import { handleApiError, validationError, successResponse, createdResponse } from '@/lib/errorHandler';
import { apiLogger } from '@/lib/logger';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Apply rate limiting
        const rateLimit = await rateLimitMiddleware(RATE_LIMITS.READ)(request, '/api/customers');
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
        const search = url.searchParams.get('search') || '';

        let query = supabase.from('customers').select('*');

        if (search) {
            query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        apiLogger.info('Customers retrieved', { count: data.length, search });

        return successResponse(data, 200, null);

    } catch (error) {
        return handleApiError(error, 'GET /api/customers');
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Apply rate limiting
        const rateLimit = await rateLimitMiddleware(RATE_LIMITS.API)(request, '/api/customers');
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

        const body = await request.json();

        // Validate input
        const validation = customerSchema.safeParse(body);
        if (!validation.success) {
            throw validationError('Invalid input', validation.error.flatten().fieldErrors);
        }

        const { full_name, phone, email, uid } = validation.data;

        // 1. Create Customer
        const { data: customer, error: custError } = await supabase
            .from('customers')
            .insert([{ full_name, phone, email }])
            .select()
            .single();

        if (custError) throw custError;
        const customerId = customer.id;

        // 2. Create Card if UID provided
        if (uid) {
            // Check if card already exists and is active
            const { data: existingCard } = await supabase
                .from('cards')
                .select('id')
                .eq('uid', uid)
                .eq('is_active', true)
                .maybeSingle();

            if (existingCard) {
                // Cleanup partial customer if needed (though RLS/DB constraints might handle this better)
                // For now, return error.
                return NextResponse.json({ message: 'Card already registered' }, { status: 400 });
            }

            const { error: cardError } = await supabase
                .from('cards')
                .insert([{ uid, customer_id: customerId, is_active: true }]);

            if (cardError) throw cardError;
        }

        apiLogger.info('Customer created', { id: customerId, full_name, hasCard: !!uid });

        return createdResponse(
            { id: customerId, full_name, phone, email, uid },
            'Customer created successfully'
        );

    } catch (error) {
        return handleApiError(error, 'POST /api/customers');
    }
}
