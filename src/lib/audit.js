import pool from './db';

/**
 * Logs an administrative action to the database.
 * @param {number} adminId - The ID of the user performing the action.
 * @param {string} actionType - A short string code for the action (e.g., 'UPDATE_SETTINGS').
 * @param {string|object} details - Additional details (will be JSON stringified if object).
 */
export async function logAudit(adminId, actionType, details) {
    try {
        const detailsString = typeof details === 'object' ? JSON.stringify(details) : details;
        await pool.query(
            'INSERT INTO audit_logs (admin_id, action_type, details) VALUES (?, ?, ?)',
            [adminId, actionType, detailsString]
        );
    } catch (e) {
        console.error('Failed to write audit log:', e);
        // Do not throw, so we don't block the main action if logging fails
    }
}
