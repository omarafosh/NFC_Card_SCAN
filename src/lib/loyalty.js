import { supabase } from '@/lib/supabase';
import cache, { CacheKeys } from '@/lib/cache';
import { LOYALTY } from '@/lib/constants';

/**
 * Fetch system settings from the database with caching
 * @returns {Promise<Object>} Object containing key-value pairs of settings
 */
export async function getSystemSettings() {
    // Try to get from cache first
    return await cache.getOrSet(
        CacheKeys.SETTINGS,
        async () => {
            try {
                const { data: rows, error } = await supabase.from('settings').select('*');
                if (error) throw error;

                const settings = {};
                rows.forEach(row => {
                    settings[row.key_name] = row.value;
                });

                // Defaults if missing
                return {
                    currency_symbol: settings.currency_symbol || LOYALTY.DEFAULT_CURRENCY,
                    points_ratio: parseFloat(settings.points_ratio) || LOYALTY.DEFAULT_POINTS_RATIO,
                    ...settings
                };
            } catch (error) {
                console.error('Error fetching settings:', error);
                return {
                    currency_symbol: LOYALTY.DEFAULT_CURRENCY,
                    points_ratio: LOYALTY.DEFAULT_POINTS_RATIO
                };
            }
        }
    );
}

/**
 * Calculate points earned for a transaction amount
 * @param {number} amount 
 * @returns {Promise<number>} Points earned
 */
export async function calculatePoints(amount) {
    const settings = await getSystemSettings();
    const ratio = settings.points_ratio;

    if (ratio <= 0) return 0;
    return Math.floor(amount / ratio);
}

/**
 * Log points transaction to the ledger
 * @param {Object} params
 * @param {number} params.customer_id
 * @param {number} params.points (Positive or Negative)
 * @param {string} params.reason
 * @param {number} [params.transaction_id]
 * @param {number} [params.admin_id]
 */
export async function logPoints({ customer_id, points, reason, transaction_id, admin_id }) {
    // 1. Log to ledger
    const { error: ledgerError } = await supabase
        .from('points_ledger')
        .insert([{
            customer_id,
            points,
            reason,
            transaction_id: transaction_id || null,
            admin_id: admin_id || null
        }]);

    if (ledgerError) throw ledgerError;

    // 2. Update customer balance
    // In Supabase, we can use a raw update or an RPC for "increment".
    // For simplicity until RPC is needed:
    const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('points_balance')
        .eq('id', customer_id)
        .single();

    if (fetchError) throw fetchError;

    const newBalance = (customer.points_balance || 0) + points;

    const { error: updateError } = await supabase
        .from('customers')
        .update({ points_balance: newBalance })
        .eq('id', customer_id);

    if (updateError) throw updateError;
}
