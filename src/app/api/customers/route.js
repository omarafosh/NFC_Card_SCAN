import { NextResponse } from 'next/server';
import pool from '@/lib/db';
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

        let query = 'SELECT * FROM customers ORDER BY created_at DESC';
        let params = [];

        if (search) {
            query = 'SELECT * FROM customers WHERE full_name LIKE ? OR phone LIKE ? ORDER BY created_at DESC';
            params = [`%${search}%`, `%${search}%`];
        }

        const [rows] = await pool.query(query, params);

        apiLogger.info('Customers retrieved', { count: rows.length, search });

        return successResponse(rows, 200, null);

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

        const { full_name, phone, email } = validation.data;

        const [result] = await pool.query(
            'INSERT INTO customers (full_name, phone, email) VALUES (?, ?, ?)',
            [full_name, phone, email]
        );

        apiLogger.info('Customer created', { id: result.insertId, full_name });

        return createdResponse(
            { id: result.insertId, full_name, phone, email },
            'Customer created successfully'
        );

    } catch (error) {
        return handleApiError(error, 'POST /api/customers');
    }
}
