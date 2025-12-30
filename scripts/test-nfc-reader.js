#!/usr/bin/env node

/**
 * Test NFC Reader - Supabase Realtime
 * 
 * This script simulates NFC card scans by inserting test data into scan_events table.
 * Useful for testing without a physical NFC reader.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import readline from 'readline';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase credentials missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TERMINAL_ID = parseInt(process.env.TERMINAL_ID) || 1;
const BRANCH_ID = parseInt(process.env.BRANCH_ID) || 1;

// Sample UIDs from seed data
const SAMPLE_UIDS = [
    'ABC123456789',  // أحمد محمد
    'XYZ987654321',  // عمر خالد
    'TEST' + Math.random().toString(36).substring(2, 12).toUpperCase()  // Random test UID
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function simulateScan(uid) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🧪 [TEST] Simulating card scan`);
    console.log(`   UID: ${uid}`);
    console.log(`   Terminal: ${TERMINAL_ID}`);
    console.log(`   Branch: ${BRANCH_ID}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const { data, error } = await supabase
            .from('scan_events')
            .insert([{
                terminal_id: TERMINAL_ID,
                branch_id: BRANCH_ID,
                uid: uid,
                processed: false
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ [Error]', error.message);
        } else {
            console.log(`✅ [Success] Scan event created!`);
            console.log(`   Event ID: ${data.id}`);
            console.log(`   Status: Broadcasted via Supabase Realtime`);
            console.log(`   ⚡ Check your frontend - it should receive this scan!`);
        }
    } catch (err) {
        console.error('❌ [Error]', err.message);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function interactiveMode() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 NFC Reader Test - Interactive Mode');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📍 Terminal ID: ${TERMINAL_ID}`);
    console.log(`🏢 Branch ID: ${BRANCH_ID}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Sample UIDs from seed data:');
    SAMPLE_UIDS.forEach((uid, index) => {
        console.log(`  ${index + 1}. ${uid}`);
    });
    console.log('');

    while (true) {
        const choice = await question('Enter UID (or number 1-3, or "q" to quit): ');

        if (choice.toLowerCase() === 'q') {
            console.log('\n👋 Goodbye!\n');
            rl.close();
            process.exit(0);
        }

        const num = parseInt(choice);
        if (num >= 1 && num <= SAMPLE_UIDS.length) {
            await simulateScan(SAMPLE_UIDS[num - 1]);
        } else if (choice.trim()) {
            await simulateScan(choice.trim());
        } else {
            console.log('⚠️  Please enter a valid UID or number\n');
        }
    }
}

// Auto mode - simulate one scan and exit
async function autoMode() {
    const uid = process.argv[2] || SAMPLE_UIDS[0];
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 NFC Reader Test - Auto Mode');
    console.log('═══════════════════════════════════════════════════════════\n');

    await simulateScan(uid);
    process.exit(0);
}

// Check if UID provided as argument
if (process.argv.length > 2 && process.argv[2] !== '-i') {
    autoMode();
} else {
    interactiveMode();
}
