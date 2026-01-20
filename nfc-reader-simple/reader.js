#!/usr/bin/env node

/**
 * Remote NFC Reader - Robust Version
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const notifier = require('node-notifier');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// --- Helper: Keep Window Open ---
function waitToExit(code = 0) {
    console.log('');
    console.log('🛑 Press any key to exit...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', process.exit.bind(process, code));
}

// --- Global Error Handlers ---
process.on('uncaughtException', (err) => {
    console.error('');
    console.error('❌ CRITICAL ERROR (Uncaught Exception):');
    console.error(err);
    waitToExit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('');
    console.error('❌ CRITICAL ERROR (Unhandled Rejection):');
    console.error(reason);
    waitToExit(1);
});

// --- Set Console Title (Windows/Mac) ---
process.stdout.write(
    String.fromCharCode(27) + "]0;" + "NFC Reader Service - Active" + String.fromCharCode(7)
);

async function main() {
    try {
        const { NFC } = require('nfc-pcsc');

        // Configuration from .env (or injected by build)
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
        const DEFAULT_TERMINAL_ID = process.env.TERMINAL_ID;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            console.error('❌ Error: Missing configuration (Supabase URL/Key)!');
            waitToExit(1);
            return;
        }

        // --- Dynamic Terminal Config ---
        const configPath = path.join(process.cwd(), 'config-terminal.json');
        let terminalId = DEFAULT_TERMINAL_ID;

        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.terminal_id) {
                    terminalId = config.terminal_id;
                    console.log(`📝 Using Terminal ID from config: ${terminalId}`);
                }
            } catch (e) {
                console.warn('⚠️  Could not read config-terminal.json, using default.');
            }
        } else {
            // Create default config file
            try {
                fs.writeFileSync(configPath, JSON.stringify({
                    terminal_id: parseInt(DEFAULT_TERMINAL_ID) || 0,
                    _comment: "You can change terminal_id here and restart the app"
                }, null, 4));
                console.log(`📄 Created default config: ${configPath}`);
            } catch (e) {
                console.warn('⚠️  Could not create config-terminal.json');
            }
        }

        if (!terminalId) {
            console.error('❌ Error: Terminal ID not found in config or build!');
            waitToExit(1);
            return;
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        console.log('╔════════════════════════════════════════╗');
        console.log('║   Remote NFC Reader v2.2 (Dynamic)    ║');
        console.log('╚════════════════════════════════════════╝');
        console.log('');
        console.log(`📡 Terminal ID: ${terminalId}`);
        console.log(`🗄️  Database: Checking connection...`);

        // Verify DB Connection
        const { error: dbError } = await supabase.from('scan_events').select('id').limit(1);
        if (dbError) {
            throw new Error(`Database Connection Failed: ${dbError.message}`);
        }
        console.log(`✅ Database: Connected`);
        console.log('');
        console.log('⏳ Waiting for NFC reader...');
        console.log('📝 Type "quit" or "exit" and press Enter to stop.');
        console.log('');

        const nfc = new NFC();

        nfc.on('reader', reader => {
            console.log('✅ Reader connected:', reader.reader.name);

            notifier.notify({
                title: 'NFC Reader',
                message: 'Reader connected successfully!',
                sound: true
            });

            let lastUid = null;
            let lastScanTime = 0;
            let lastRemovalTime = 0;

            reader.on('card', async card => {
                const uid = card.uid.toUpperCase();
                const now = Date.now();

                // Debounce: Ignore if same card read recently (2.5s) OR immediately after removal (1s)
                const isRecentRead = (uid === lastUid && (now - lastScanTime) < 2500);
                const isBounceOnRemoval = (uid === lastUid && (now - lastRemovalTime) < 1000);

                if (isRecentRead || isBounceOnRemoval) {
                    return;
                }

                lastUid = uid;
                lastScanTime = now;

                console.log('');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📇 Card detected!');
                console.log('🔢 UID:', uid);

                try {
                    // Find card in database
                    const { data: cardData, error: cardError } = await supabase
                        .from('cards')
                        .select('*, customers(*)')
                        .eq('uid', uid)
                        .eq('is_active', true)
                        .is('deleted_at', null)
                        .maybeSingle();

                    // Insert scan event
                    const { error: scanError } = await supabase
                        .from('scan_events')
                        .insert({
                            uid,
                            terminal_id: parseInt(terminalId),
                            status: 'PRESENT'
                        });

                    if (scanError) {
                        console.error('❌ Failed to record scan:', scanError.message);
                    } else {
                        console.log('✅ Scan uploaded to cloud');
                        if (cardData?.customers) {
                            console.log(`👤 Customer: ${cardData.customers.full_name}`);
                        } else {
                            console.log('⚠️  Unknown Card');
                        }
                    }

                } catch (error) {
                    console.error('❌ Processing Error:', error.message);
                }
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            });

            reader.on('card.off', async card => {
                console.log('📤 Card removed:', card.uid.toUpperCase());
                lastRemovalTime = Date.now();
                // do NOT clear lastUid here, to prevent bounces

                try {
                    await supabase
                        .from('scan_events')
                        .insert({
                            uid: card.uid.toUpperCase(),
                            terminal_id: parseInt(terminalId),
                            status: 'REMOVED'
                        });
                } catch (e) {
                    // Ignore errors for disconnect events
                }
            });

            reader.on('end', () => {
                console.log('❌ Reader disconnected');
            });

            reader.on('error', err => {
                console.error('⚠️  Reader Error:', err.message);
            });
        });

        nfc.on('error', err => {
            if (err.message.includes('No such device')) {
                // Common when no reader attached, just log
                console.log('⚠️  Info: No NFC Reader found yet. Waiting...');
            } else {
                console.error('❌ NFC Service Error:', err.message);
            }
        });

    } catch (err) {
        console.error('❌ FATAL STARTUP ERROR:', err);
        waitToExit(1);
    }
}

// --- Interactive Console ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === 'quit' || cmd === 'exit') {
        console.log('👋 Bye!');
        process.exit(0);
    }
});

// Start
main();
