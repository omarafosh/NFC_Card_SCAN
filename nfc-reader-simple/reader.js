#!/usr/bin/env node

/**
 * Simple NFC Reader for macOS
 * Reads NFC cards and sends UIDs to the web dashboard
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
console.log('║   NFC Reader - Simple Mode v1.0       ║');
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

        // Send to web dashboard via WebSocket simulation
        // The dashboard will pick this up via Supabase Realtime
        try {
            const response = await fetch(`${WEBSITE_URL}/api/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-terminal-id': TERMINAL_ID
                },
                body: JSON.stringify({
                    uid,
                    terminal_id: TERMINAL_ID,
                    source: 'external_reader'
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Sent to dashboard successfully!');

                if (data.customer) {
                    console.log('👤 Customer:', data.customer.full_name);
                    notifier.notify({
                        title: 'Card Scanned',
                        message: `Welcome ${data.customer.full_name}!`,
                        sound: true
                    });
                } else {
                    console.log('⚠️  Card not registered');
                    notifier.notify({
                        title: 'Unknown Card',
                        message: 'Card not registered in system',
                        sound: true
                    });
                }
            } else {
                console.log('❌ Failed to send to dashboard');
            }
        } catch (error) {
            console.log('❌ Network error:', error.message);
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
