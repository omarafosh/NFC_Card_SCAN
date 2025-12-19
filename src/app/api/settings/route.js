import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSystemSettings } from '@/lib/loyalty';
import { logAudit } from '@/lib/audit';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const settings = await getSystemSettings();
    return NextResponse.json(settings);
}

export async function POST(request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();

        // Upsert settings
        const keys = Object.keys(body);
        for (const key of keys) {
            await pool.query(
                'INSERT INTO settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
                [key, String(body[key])]
            );
        }

        // Audit Log
        await logAudit(session.id, 'UPDATE_SETTINGS', body);

        return NextResponse.json({ message: 'Settings saved' });
    } catch (error) {
        return NextResponse.json({ message: 'Error saving settings' }, { status: 500 });
    }
}
