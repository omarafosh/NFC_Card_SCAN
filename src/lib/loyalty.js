import pool from '@/lib/db';
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
                const [rows] = await pool.query('SELECT * FROM settings');
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
 * @param {any} [params.connection] Optional transaction connection
 */
export async function logPoints({ customer_id, points, reason, transaction_id, admin_id, connection }) {
    const db = connection || pool;

    await db.query(
        'INSERT INTO points_ledger (customer_id, points, reason, transaction_id, admin_id) VALUES (?, ?, ?, ?, ?)',
        [customer_id, points, reason, transaction_id || null, admin_id || null]
    );

    // Update customer balance directly
    await db.query(
        'UPDATE customers SET points_balance = points_balance + ? WHERE id = ?',
        [points, customer_id]
    );
}
