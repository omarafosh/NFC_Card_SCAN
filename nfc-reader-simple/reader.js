#!/usr/bin/env node

/**
 * Remote NFC Reader using Supabase Realtime
 * Writes directly to database - all dashboards receive updates instantly
 */

require('dotenv').config();
const { NFC } = require('nfc-pcsc');
const { createClient } = require('@supabase/supabase-js');
const notifier = require('node-notifier');

// Configuration from .env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TERMINAL_ID = process.env.TERMINAL_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TERMINAL_ID) {
    console.error('❌ Error: Missing configuration!');
    console.error('Please add to .env file:');
    console.error('  SUPABASE_URL=your_supabase_url');
    console.error('  SUPABASE_SERVICE_KEY=your_service_role_key');
    console.error('  TERMINAL_ID=15');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('╔════════════════════════════════════════╗');
console.log('║   Remote NFC Reader v2.0              ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log(`📡 Terminal ID: ${TERMINAL_ID}`);
console.log(`🗄️  Database: Connected`);
console.log('');
console.log('⏳ Waiting for NFC reader...');

const nfc = new NFC();

nfc.on('reader', reader => {
    console.log('✅ Reader connected:', reader.reader.name);

    notifier.notify({
        title: 'Remote NFC Reader',
        message: 'Reader connected successfully!',
        sound: true
    });

    reader.on('card', async card => {
        const uid = card.uid.toUpperCase();
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📇 Card detected!');
        console.log('🔢 UID:', uid);
        console.log('⏰ Time:', new Date().toLocaleString('ar-EG'));

        try {
            // Find card in database
            const { data: cardData, error: cardError } = await supabase
                .from('cards')
                .select('*, customers(*)')
                .eq('uid', uid)
                .eq('is_active', true)
                .is('deleted_at', null)
                .maybeSingle();

            if (cardError) {
                console.log('❌ Database error:', cardError.message);
                return;
            }

            // Insert scan event
            const { error: scanError } = await supabase
                .from('scan_events')
                .insert({
                    uid,
                    customer_id: cardData?.customer_id || null,
                    terminal_id: parseInt(TERMINAL_ID),
                    status: cardData ? 'success' : 'unknown_card',
                    scanned_at: new Date().toISOString()
                });

            if (scanError) {
                console.log('❌ Failed to record scan:', scanError.message);
                return;
            }

            if (cardData && cardData.customers) {
                console.log('✅ Card registered!');
                console.log('👤 Customer:', cardData.customers.full_name);
                console.log('💰 Balance:', cardData.customers.balance);

                notifier.notify({
                    title: 'Card Scanned',
                    message: `Welcome ${cardData.customers.full_name}!`,
                    sound: true
                });
            } else {
                console.log('⚠️  Card not registered');
                console.log('   UID:', uid);

                notifier.notify({
                    title: 'Unknown Card',
                    message: `UID: ${uid}`,
                    sound: true
                });
            }

            console.log('📡 Sent to all dashboards via Realtime');

        } catch (error) {
            console.log('❌ Error:', error.message);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
    });

    reader.on('error', err => {
        console.log('⚠️  Reader error:', err.message);
    });

    reader.on('end', () => {
        console.log('❌ Reader disconnected');
        notifier.notify({
            title: 'Remote NFC Reader',
            message: 'Reader disconnected',
            sound: true
        });
    });
});

nfc.on('error', err => {
    console.log('❌ NFC Error:', err.message);
});

// Keep alive
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});

console.log('');
console.log('💡 Ready! Place a card on the reader...');
console.log('   All dashboards will receive updates instantly');
console.log('   Press Ctrl+C to exit');
console.log('');
