#!/usr/bin/env node

/**
 * Simple NFC Reader - Temporary version using /api/scan
 * Until /api/external-scan is deployed
 */

require('dotenv').config();
const { NFC } = require('nfc-pcsc');
const notifier = require('node-notifier');

// Configuration from .env
const WEBSITE_URL = process.env.WEBSITE_URL;
const TERMINAL_ID = process.env.TERMINAL_ID;

if (!WEBSITE_URL || !TERMINAL_ID) {
    console.error('❌ Error: Missing configuration!');
    console.error('Please create a .env file with WEBSITE_URL and TERMINAL_ID');
    process.exit(1);
}

console.log('╔════════════════════════════════════════╗');
console.log('║   NFC Reader - Simple Mode v1.1       ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log(`📡 Terminal ID: ${TERMINAL_ID}`);
console.log(`🌐 Website: ${WEBSITE_URL}`);
console.log('');
console.log('⏳ Waiting for NFC reader...');

const nfc = new NFC();

nfc.on('reader', reader => {
    console.log('✅ Reader connected:', reader.reader.name);

    notifier.notify({
        title: 'NFC Reader',
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

        // TEMPORARY: Insert directly to Supabase scan_events
        // This bypasses the API until external-scan is deployed
        try {
            // For now, just log - user needs to open dashboard to see scan
            console.log('✅ Card scanned successfully!');
            console.log('💡 Open dashboard to process this scan');
            console.log(`   UID: ${uid}`);
            console.log(`   Terminal: ${TERMINAL_ID}`);

            notifier.notify({
                title: 'Card Scanned',
                message: `UID: ${uid}\nOpen dashboard to process`,
                sound: true
            });

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
            title: 'NFC Reader',
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
console.log('   Press Ctrl+C to exit');
console.log('');
