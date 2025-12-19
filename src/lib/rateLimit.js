/**
 * Rate Limiting Utility
 * 
 * Provides rate limiting functionality for API routes to prevent abuse.
 * Uses database-backed storage for distributed rate limiting.
 */

import pool from './db.js';
import { apiLogger } from './logger.js';

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
    // Strict limits for authentication endpoints
    AUTH: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 5,
        message: 'Too many attempts. Please try again later.'
    },

    // Moderate limits for API endpoints
    API: {
        windowMs: 60 * 1000, // 1 minute
        maxAttempts: 30,
        message: 'Too many requests. Please slow down.'
    },

    // Lenient limits for read operations
    READ: {
        windowMs: 60 * 1000, // 1 minute
        maxAttempts: 100,
        message: 'Rate limit exceeded. Please try again later.'
    }
};

/**
 * Check if request should be rate limited
 * 
 * @param {string} identifier - Unique identifier (IP address, user ID, etc.)
 * @param {string} endpoint - API endpoint being accessed
 * @param {Object} config - Rate limit configuration
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date}>}
 */
export async function checkRateLimit(identifier, endpoint, config = RATE_LIMITS.API) {
    const key = `${endpoint}:${identifier}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    try {
        // Create rate_limits table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rate_limits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(255) NOT NULL,
                attempt_count INT DEFAULT 1,
                window_start TIMESTAMP NOT NULL,
                last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_key_window (key_name, window_start)
            )
        `);

        // Clean up old entries (older than window)
        await pool.query(
            'DELETE FROM rate_limits WHERE window_start < ?',
            [windowStart]
        );

        // Get current rate limit status
        const [rows] = await pool.query(
            'SELECT * FROM rate_limits WHERE key_name = ? AND window_start >= ?',
            [key, windowStart]
        );

        let attemptCount = 0;
        let resetAt = new Date(now.getTime() + config.windowMs);

        if (rows.length > 0) {
            const record = rows[0];
            attemptCount = record.attempt_count;
            resetAt = new Date(record.window_start.getTime() + config.windowMs);

            // Increment attempt count
            await pool.query(
                'UPDATE rate_limits SET attempt_count = attempt_count + 1, last_attempt = NOW() WHERE id = ?',
                [record.id]
            );
            attemptCount++;
        } else {
            // Create new rate limit record
            await pool.query(
                'INSERT INTO rate_limits (key_name, attempt_count, window_start) VALUES (?, 1, ?)',
                [key, now]
            );
            attemptCount = 1;
        }

        const allowed = attemptCount <= config.maxAttempts;
        const remaining = Math.max(0, config.maxAttempts - attemptCount);

        return {
            allowed,
            remaining,
            resetAt,
            message: allowed ? null : config.message
        };

    } catch (error) {
        apiLogger.error('Rate limit check error', error);
        // On error, allow the request (fail open)
        return {
            allowed: true,
            remaining: config.maxAttempts,
            resetAt: new Date(now.getTime() + config.windowMs),
            message: null
        };
    }
}

/**
 * Middleware factory for rate limiting
 * 
 * @param {Object} config - Rate limit configuration
 * @returns {Function} Middleware function
 */
export function rateLimitMiddleware(config = RATE_LIMITS.API) {
    return async (request, endpoint) => {
        // Get identifier (IP address or user ID)
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';

        const result = await checkRateLimit(ip, endpoint, config);

        return result;
    };
}

/**
 * Reset rate limit for a specific identifier and endpoint
 * Useful for testing or manual intervention
 * 
 * @param {string} identifier - Unique identifier
 * @param {string} endpoint - API endpoint
 */
export async function resetRateLimit(identifier, endpoint) {
    const key = `${endpoint}:${identifier}`;

    try {
        await pool.query(
            'DELETE FROM rate_limits WHERE key_name = ?',
            [key]
        );
        return true;
    } catch (error) {
        console.error('Error resetting rate limit:', error);
        return false;
    }
}
