#!/usr/bin/env node

/**
 * Cleanup Old Scan Events
 * 
 * This script removes old scan events from the database to prevent table bloat.
 * Run this periodically (e.g., daily via cron job).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase credentials missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const RETENTION_HOURS = parseInt(process.env.SCAN_EVENTS_RETENTION_HOURS) || 24;

async function cleanup() {
    console.log('🧹 Scan Events Cleanup Script');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Retention period: ${RETENTION_HOURS} hours`);

    const cutoffDate = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);
    console.log(`🗑️  Deleting events older than: ${cutoffDate.toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Count events to be deleted
        const { count: totalCount } = await supabase
            .from('scan_events')
            .select('*', { count: 'exact', head: true });

        const { count: oldCount } = await supabase
            .from('scan_events')
            .select('*', { count: 'exact', head: true })
            .lt('created_at', cutoffDate.toISOString());

        console.log(`📊 Total scan events: ${totalCount}`);
        console.log(`📊 Events to delete: ${oldCount}\n`);

        if (oldCount === 0) {
            console.log('✅ No old events to delete. Database is clean!\n');
            return;
        }

        // Delete old events
        const { error } = await supabase
            .from('scan_events')
            .delete()
            .lt('created_at', cutoffDate.toISOString());

        if (error) {
            console.error('❌ Error deleting events:', error.message);
            process.exit(1);
        }

        console.log(`✅ Successfully deleted ${oldCount} old scan events`);
        console.log(`📊 Remaining events: ${totalCount - oldCount}\n`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Cleanup completed successfully!\n');

    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        process.exit(1);
    }
}

cleanup();
