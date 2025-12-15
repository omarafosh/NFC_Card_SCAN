import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { loginSchema } from '@/lib/schemas';

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

        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        let user = rows[0];

        // For initial setup, if no users exist and credentials match admin/admin, create the root admin
        if (!user && username === 'admin' && password === 'admin') {
            const hashedPassword = await bcrypt.hash('admin', 10);
            const [result] = await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin']);

            // Manually set user to proceed without recursive call (which fails because body is already read)
            user = {
                id: result.insertId,
                username: 'admin',
                role: 'admin',
                password_hash: hashedPassword
            };
        }

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
        }

        const token = signToken({ id: user.id, username: user.username, role: user.role });

        const cookieStore = await cookies();
        cookieStore.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 8, // 8 hours
            path: '/',
        });

        return NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
