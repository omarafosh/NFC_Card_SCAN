import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/errorHandler';
import crypto from 'crypto';
import { logAudit } from '@/lib/audit';

// Secret key for HMAC generation - in production this should be in .env
const NFC_SECRET_KEY = process.env.NFC_SECRET_KEY || 'default-secret-key-change-me';

function generateSignature(uid) {
    if (!uid) return null;
    return crypto
        .createHmac('sha256', NFC_SECRET_KEY)
        .update(uid.toUpperCase())
        .digest('hex')
        .substring(0, 16); // Use first 16 chars (8 bytes) for storage on card
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { uid, customer_id } = body;

        if (!uid) {
            return NextResponse.json({ message: 'UID is required' }, { status: 400 });
        }

        // 1. Generate Signature
        const signature = generateSignature(uid);

        // 2. Check if card exists
        const { data: existingCard } = await supabase
            .from('cards')
            .select('*')
            .eq('uid', uid)
            .maybeSingle();

        let cardResult;

        if (existingCard) {
            // Update existing card
            const updates = {
                signature,
                enrolled_at: new Date().toISOString(),
                enrolled_by: session.user.id,
                is_active: true,
                deleted_at: null
            };

            // Only update customer_id if provided explicitly
            if (customer_id !== undefined) {
                updates.customer_id = customer_id || null;
            }

            const { data, error } = await supabase
                .from('cards')
                .update(updates)
                .eq('uid', uid)
                .select()
                .single();

            if (error) throw error;
            cardResult = data;
        } else {
            // Create new card
            const { data, error } = await supabase
                .from('cards')
                .insert({
                    uid,
                    customer_id: customer_id || null, // Allow null
                    signature,
                    enrolled_at: new Date().toISOString(),
                    enrolled_by: session.user.id,
                    is_active: true,
                    // Set default expiry 1 year from now
                    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            cardResult = data;
        }

        // 3. Log Audit
        await logAudit({
            action: 'ENROLL_CARD',
            entity: 'cards',
            entityId: cardResult.id,
            details: { uid, customer_id, signature_generated: true },
            req: request
        });

        return successResponse({
            uid,
            signature,
            success: true,
            message: 'Card enrolled successfully'
        });

    } catch (error) {
        return handleApiError(error, 'POST /api/cards/enroll');
    }
}
