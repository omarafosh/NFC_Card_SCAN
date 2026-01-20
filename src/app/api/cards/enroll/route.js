// Force rebuild: v4
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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

    // Handle different session structures (JWT payload vs Supabase session)
    const userId = session.user?.id || session.id || session.sub;

    if (!userId) {
        return NextResponse.json({ message: 'Unauthorized: Invalid Session Structure' }, { status: 401 });
    }

    // Ensure Admin Client is available
    if (!supabaseAdmin) {
        return NextResponse.json({ message: 'Server Misconfiguration: Missing Service Role Key' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { uid, customer_id } = body;

        if (!uid) {
            return NextResponse.json({ message: 'UID is required' }, { status: 400 });
        }

        // Validate customer_id is a valid UUID
        const isValidUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        let validCustomerId = customer_id;
        if (customer_id && !isValidUuid(customer_id)) {
            console.warn(`Invalid UUID for customer_id: ${customer_id}. Treating as null.`);
            validCustomerId = null;
        }

        // 0. Fetch Global Passphrase from Settings
        let globalSignature = 'yamen'; // Default Fallback
        try {
            const { data: setting } = await supabaseAdmin
                .from('settings')
                .select('value')
                .eq('key_name', globalSignature)
                .maybeSingle();

            if (setting?.value) {
                globalSignature = setting.value;
            }
        } catch (e) {
            console.warn('Could not load card_secret_phrase, using default:', e.message);
        }

        // 1. Set Signature (Derived from Passphrase)
        // We hash the passphrase and take first 8 bytes (16 hex chars) to fit NTAG pages 4-5
        const signature = crypto.createHash('sha256').update(globalSignature).digest('hex').substring(0, 16).toUpperCase();

        // 2. Check if card exists (Using Admin Client to bypass RLS)
        const { data: existingCard } = await supabaseAdmin
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
                enrolled_by: userId,
                is_active: true,
                deleted_at: null
            };

            // Only update customer_id if provided explicitly
            if (customer_id !== undefined) {
                updates.customer_id = validCustomerId;
            }

            const { data, error } = await supabaseAdmin
                .from('cards')
                .update(updates)
                .eq('uid', uid)
                .select()
                .single();

            if (error) throw error;
            cardResult = data;
        } else {
            // Create new card
            const { data, error } = await supabaseAdmin
                .from('cards')
                .insert({
                    uid,
                    customer_id: validCustomerId, // Use the validated ID (or null)
                    signature,
                    enrolled_at: new Date().toISOString(),
                    enrolled_by: userId,
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
        console.error('Enrollment API Error:', error);
        return NextResponse.json({
            success: false,
            message: error.message || 'Server Error',
            details: error.details,
            hint: error.hint
        }, { status: 500 });
    }
}
