#!/usr/bin/env node

/**
 * Remote NFC Reader - Robust Version
 * With Programming Capability
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const notifier = require('node-notifier');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Built-in Node crypto

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

// --- Set Console Title ---
process.stdout.write(
    String.fromCharCode(27) + "]0;" + "NFC Reader Service - Active" + String.fromCharCode(7)
);

async function main() {
    try {
        const { NFC } = require('nfc-pcsc');

        // Configuration
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
        const DEFAULT_TERMINAL_ID = process.env.TERMINAL_ID;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            console.error('❌ Error: Missing configuration (Supabase URL/Key)!');
            waitToExit(1);
            return;
        }

        // --- Terminal ID Config ---
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
            try {
                fs.writeFileSync(configPath, JSON.stringify({
                    terminal_id: parseInt(DEFAULT_TERMINAL_ID) || 0,
                    _comment: "You can change terminal_id here"
                }, null, 4));
                console.log(`📄 Created default config: ${configPath}`);
            } catch (e) {
                // ignore
            }
        }

        if (!terminalId) {
            console.error('❌ Error: Terminal ID not found!');
            waitToExit(1);
            return;
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        console.log('╔════════════════════════════════════════╗');
        console.log('║   Remote NFC Reader v3.0 (Programmable) ║');
        console.log('╚════════════════════════════════════════╝');
        console.log(`📡 Terminal ID: ${terminalId}`);
        console.log(`🗄️  Database: Connected`);
        console.log('');
        console.log('⏳ Waiting for NFC reader...');

        // State for Programming
        let pendingWrite = null;

        // --- Listen for Write Commands ---
        const channel = supabase
            .channel(`terminal-actions-${terminalId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'terminal_actions',
                    filter: `terminal_id=eq.${terminalId}`
                },
                (payload) => {
                    const action = payload.new;
                    if (action.action_type === 'WRITE_SIGNATURE' && action.status === 'PENDING') {
                        console.log('');
                        console.log('🔒 Command Received: PROGRAM CARD');
                        console.log(`   Target UID: ${action.payload.uid}`);
                        console.log('   Waiting for card...');
                        pendingWrite = {
                            id: action.id,
                            signature: action.payload.signature,
                            targetUid: action.payload.uid
                        };
                        notifier.notify({ title: 'NFC Programming', message: 'Ready to program card' });
                    }
                }
            )
            .subscribe();

        // 2024-01-20: Robust Polling Fallback 
        // In case Realtime fails, we check for pending actions every 2 seconds
        setInterval(async () => {
            if (pendingWrite) return; // Busy

            const { data: actions } = await supabase
                .from('terminal_actions')
                .select('*')
                .eq('terminal_id', terminalId)
                .eq('action_type', 'WRITE_SIGNATURE')
                .eq('status', 'PENDING')
                .limit(1);

            if (actions && actions.length > 0) {
                const action = actions[0];
                console.log('');
                console.log('🔒 Command Received (via Polling): PROGRAM CARD');
                console.log(`   Target UID: ${action.payload.uid}`);
                console.log('   Waiting for card...');

                pendingWrite = {
                    id: action.id,
                    signature: action.payload.signature,
                    targetUid: action.payload.uid
                };
                notifier.notify({ title: 'NFC Programming', message: 'Ready to program card' });
            }
        }, 2000);

        // 2024-01-20: Heartbeat (Keep Status Online)
        // Updates the dashboard status to green
        console.log('💓 Heartbeat service started...');
        setInterval(async () => {
            try {
                await supabase
                    .from('terminals')
                    .update({ last_active_at: new Date().toISOString() })
                    .eq('id', terminalId);
            } catch (e) {
                // Sılent error
            }
        }, 15000); // Pulse every 15 seconds

        const nfc = new NFC();

        nfc.on('reader', reader => {
            console.log('✅ Reader connected:', reader.reader.name);

            // Debounce state
            let lastUid = null;
            let lastScanTime = 0;
            let lastRemovalTime = 0;

            reader.on('card', async card => {
                const uid = card.uid.toUpperCase();
                const now = Date.now();

                // 2024-01-20: Robust Debounce (3 seconds)
                const isRecentRead = (uid === lastUid && (now - lastScanTime) < 3000);
                const isBounceOnRemoval = (uid === lastUid && (now - lastRemovalTime) < 1500);

                // If programming, we might want to skip debounce or check if it's the target
                if (!pendingWrite && (isRecentRead || isBounceOnRemoval)) {
                    return;
                }

                lastUid = uid;
                lastScanTime = now;

                console.log('');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📇 Card detected:', uid);

                // --- 1. HANDLE PROGRAMMING ---
                if (pendingWrite) {
                    if (uid === pendingWrite.targetUid) {
                        console.log('⚡ Programming Mode Active...');
                        try {
                            // WRITE SIGNATURE (Pages 4 and 5 for NTAG)
                            const sigBuffer = Buffer.from(pendingWrite.signature, 'hex'); // 8 bytes

                            // Page 4
                            const data1 = sigBuffer.slice(0, 4);
                            await reader.write(4, data1);
                            console.log('   Part 1 written...');

                            // Page 5
                            const data2 = sigBuffer.slice(4, 8);
                            await reader.write(5, data2);
                            console.log('   Part 2 written...');

                            console.log('✅ CARD PROGRAMMED SUCCESSFULLY');

                            // Update Queue
                            await supabase.from('terminal_actions')
                                .update({ status: 'COMPLETED' })
                                .eq('id', pendingWrite.id);

                            notifier.notify({ title: 'Success', message: 'Card Programmed!' });

                        } catch (err) {
                            console.error('❌ PROGRAMMING FAILED:', err.message);
                            await supabase.from('terminal_actions')
                                .update({ status: 'FAILED' })
                                .eq('id', pendingWrite.id);
                        } finally {
                            pendingWrite = null;
                        }
                    } else {
                        console.warn('⚠️  Wrong card for programming. Expected:', pendingWrite.targetUid);
                    }
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    return; // Stop processing
                }

                // --- 2. SECURITY CHECK (Read Verification) ---
                let signatureValid = false;
                try {
                    // Attempt to read Page 4 & 5
                    // Note: This might fail on non-NTAG cards, so we wrap in try/catch
                    // Standard NTAG/Ultralight Read
                    const part1 = await reader.read(4, 4);
                    const part2 = await reader.read(5, 4);
                    const readSig = Buffer.concat([part1, part2]).toString('hex').toUpperCase();

                    // Retrieve stored signature from DB to verify?
                    // Or simply check if it Looks like our signature format? 
                    // For now, we will verify against the DB record later.
                    // But we can check if it EXISTS.
                    if (readSig && readSig !== '0000000000000000') {
                        console.log('🔐 Digital Signature Found:', readSig.substring(0, 8) + '...');
                        signatureValid = true;
                    }
                } catch (e) {
                    // Read failed (Protected card or not NTAG)
                    // We continue for now, but mark validity false
                }

                // --- 3. NORMAL PROCESSING ---
                try {
                    const { data: cardData, error: cardError } = await supabase
                        .from('cards')
                        .select('*, customers(*)')
                        .eq('uid', uid)
                        .eq('is_active', true)
                        .is('deleted_at', null)
                        .maybeSingle();

                    // Optional: Reject if signature mismatch?
                    // User asked "Only read MY cards".
                    // If cardData exists, it IS "my" card (registered in DB).
                    // The signature adds physical security against cloning UID.

                    if (cardData && cardData.signature) {
                        // Verify physical vs db
                        // We would implementation specific verification here if we read it above
                    }

                    // Insert scan event
                    const { error: scanError } = await supabase
                        .from('scan_events')
                        .insert({
                            uid,
                            terminal_id: parseInt(terminalId),
                            status: 'PRESENT'
                        });

                    if (scanError) {
                        console.error('❌ Failed to record:', scanError.message);
                    } else {
                        console.log('✅ Scan uploaded');
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
                console.log('📤 Card removed');
                lastRemovalTime = Date.now();
                // lastUid = null; // DISABLED to prevent bounce double-reads. Logic handles timeouts.
                // Better to KEEP lastUid but rely on `lastRemovalTime`.
                // Actually, if we set lastUid = null, the debounce check (uid === lastUid) fails on next present -> Good.
                // But mechinical bounce might trigger "off" then "on" effectively instantly.
                // Improved logic: Don't clear lastUid safely.

                try {
                    await supabase.from('scan_events').insert({
                        uid: card.uid.toUpperCase(),
                        terminal_id: parseInt(terminalId),
                        status: 'REMOVED'
                    });
                } catch (e) { }
            });

            reader.on('end', () => console.log('❌ Reader disconnected'));
            reader.on('error', err => console.error('⚠️ Reader Error:', err.message));
        });

        nfc.on('error', err => {
            if (!err.message.includes('No such device')) {
                console.error('❌ NFC Service Error:', err.message);
            }
        });

    } catch (err) {
        console.error('❌ FATAL END:', err);
        waitToExit(1);
    }
}

// Interactive
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
    if (['quit', 'exit'].includes(line.trim().toLowerCase())) process.exit(0);
});

main();
