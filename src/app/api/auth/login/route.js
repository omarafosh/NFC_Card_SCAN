import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { loginSchema } from '@/lib/schemas';
import { AUTH, ERROR_CODES, ENV } from '@/lib/constants';
import { handleApiError, authError } from '@/lib/errorHandler';
import { authLogger } from '@/lib/logger';

export async function POST(request) {
    try {
        const body = await request.json();

        // Validate input
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({
                message: 'Invalid input',
                errors: validation.error.flatten().fieldErrors
            }, { status: 400 });
        }

        const { username, password } = validation.data;

        // Get IP
        const ip = request.headers.get('x-forwarded-for') || 'unknown';

        // 1. Check Rate Limit
        const [attempts] = await pool.query('SELECT * FROM login_attempts WHERE ip_address = ? AND username = ?', [ip, username]);
        if (attempts.length > 0) {
            const attempt = attempts[0];
            if (attempt.locked_until && new Date(attempt.locked_until) > new Date()) {
                const waitMinutes = Math.ceil((new Date(attempt.locked_until) - new Date()) / 60000);
                authLogger.warn('Account locked', { username, ip, waitMinutes });
                return NextResponse.json({
                    message: `Account locked. Try again in ${waitMinutes} minutes.`,
                    errorCode: ERROR_CODES.AUTH_ACCOUNT_LOCKED
                }, { status: 429 });
            }
        }

        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        let user = rows[0];

        // Auto-create admin ONLY in development if explicitly allowed
        // This is a convenience feature for initial setup - NEVER use in production
        if (!user && username === 'admin' && password === 'admin') {
            // Check if auto-admin creation is allowed
            const allowAutoAdmin = process.env.ALLOW_AUTO_ADMIN === 'true';
            const isDevelopment = ENV.isDevelopment;

            if (!allowAutoAdmin || !isDevelopment) {
                // Log security warning
                authLogger.warn(
                    'Attempted to auto-create admin account - BLOCKED',
                    { allowAutoAdmin, isDevelopment, ip }
                );
                return NextResponse.json({
                    message: 'Invalid credentials. For first-time setup, use the create-admin script.'
                }, { status: 401 });
            }

            // Only reached in development with ALLOW_AUTO_ADMIN=true
            authLogger.warn('Creating default admin account (development only)', { ip });
            const hashedPassword = await bcrypt.hash('admin', 10);
            const [result] = await pool.query(
                'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                ['admin', hashedPassword, 'admin']
            );

            user = {
                id: result.insertId,
                username: 'admin',
                role: 'admin',
                password_hash: hashedPassword
            };
        }

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            // Increment fail count
            await pool.query(`
                INSERT INTO login_attempts (ip_address, username, attempt_count, last_attempt_at) 
                VALUES (?, ?, 1, NOW()) 
                ON DUPLICATE KEY UPDATE 
                    attempt_count = attempt_count + 1, 
                    last_attempt_at = NOW(),
                    locked_until = CASE WHEN attempt_count >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE) ELSE NULL END
             `, [ip, username, AUTH.MAX_LOGIN_ATTEMPTS, AUTH.LOGIN_LOCK_DURATION_MINUTES]);

            authLogger.warn('Failed login attempt', { username, ip });
            return NextResponse.json({
                message: 'Invalid credentials',
                errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS
            }, { status: 401 });
        }

        // Reset fail count on success
        await pool.query('DELETE FROM login_attempts WHERE ip_address = ? AND username = ?', [ip, username]);

        const token = signToken({ id: user.id, username: user.username, role: user.role });

        const cookieStore = await cookies();
        cookieStore.set(AUTH.COOKIE_NAME, token, {
            httpOnly: true,
            secure: ENV.isProduction,
            sameSite: 'strict',
            maxAge: AUTH.COOKIE_MAX_AGE,
            path: '/',
        });

        authLogger.info('Successful login', { userId: user.id, username: user.username, role: user.role });

        return NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });

    } catch (error) {
        return handleApiError(error, 'POST /api/auth/login');
    }
}
