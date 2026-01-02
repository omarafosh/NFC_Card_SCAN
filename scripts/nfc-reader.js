import { NFC } from 'nfc-pcsc';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import notifier from 'node-notifier';

// Load environment variables
config();

const CONFIG_FILE = path.join(process.cwd(), 'terminal-config.json');
const LOG_FILE = path.join(process.cwd(), 'reader.log');

// Supabase Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    log('❌ Error: Supabase credentials missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function log(message) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${message}`;
    console.log(formatted);
    fs.appendFileSync(LOG_FILE, formatted + '\n');
}

function notify(title, message, iconType = 'info') {
    notifier.notify({
        title: `NFC Discount - ${title}`,
        message: message,
        sound: true,
        wait: false
    });
}

function getTerminalConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (e) {
            log('⚠️ Error reading config file.');
        }
    }

    // Default if no file (for first run or env backup)
    return {
        TERMINAL_ID: parseInt(process.env.TERMINAL_ID) || null,
        BRANCH_ID: parseInt(process.env.BRANCH_ID) || null,
        SECRET: process.env.TERMINAL_SECRET || null
    };
}

async function syncTerminalStatus(terminalId) {
    try {
        const { data, error } = await supabase
            .from('terminals')
            .update({
                last_sync: new Date().toISOString(),
                is_active: true
            })
            .eq('id', terminalId)
            .select();

        if (error || !data?.[0]) {
            log(`⚠️ Terminal ID ${terminalId} not verified.`);
            return false;
        }
        return data[0];
    } catch (err) {
        log(`❌ Sync Error: ${err.message}`);
        return false;
    }
}

async function startReader() {
    const config = getTerminalConfig();

    if (!config.TERMINAL_ID) {
        log('❌ Missing TERMINAL_ID. Please configure terminal-config.json');
        notify('Configuration Error', 'Terminal ID is missing!', 'error');
        process.exit(1);
    }

    log(`🚀 Starting NFC Service for Terminal ${config.TERMINAL_ID}...`);

    const terminal = await syncTerminalStatus(config.TERMINAL_ID);
    if (terminal) {
        log(`✅ Online as "${terminal.name}"`);
        notify('System Ready', `Terminal "${terminal.name}" is now online.`);
    }

    const nfc = new NFC();

    nfc.on('reader', (reader) => {
        log(`🟢 Reader Found: ${reader.name}`);

        reader.on('card', async (card) => {
            const uid = card.uid;
            log(`💳 Card Scanned: ${uid}`);

            try {
                const { error } = await supabase
                    .from('scan_events')
                    .insert([{
                        terminal_id: config.TERMINAL_ID,
                        branch_id: config.BRANCH_ID,
                        uid: uid,
                        processed: false
                    }]);

                if (error) throw error;

                log('✅ Scan uploaded.');
                notify('Success', 'Card scanned successfully!');

                // Update terminal heartbeat
                await supabase
                    .from('terminals')
                    .update({ last_sync: new Date().toISOString() })
                    .eq('id', config.TERMINAL_ID);

            } catch (err) {
                log(`❌ Scan Upload Failed: ${err.message}`);
                notify('Upload Failed', 'Check your internet connection.', 'error');
            }
        });

        reader.on('error', (err) => log(`⚠️ Reader Error: ${err.message}`));
        reader.on('end', () => log(`🔴 Reader Disconnected: ${reader.name}`));
    });

    nfc.on('error', (err) => log(`❌ NFC Manager Error: ${err.message}`));

    // Heartbeat loop (every 5 minutes)
    setInterval(async () => {
        await supabase
            .from('terminals')
            .update({ last_sync: new Date().toISOString() })
            .eq('id', config.TERMINAL_ID);
        log('💓 Heartbeat sent.');
    }, 5 * 60 * 1000);
}

startReader().catch(err => {
    log(`💥 Fatal Error: ${err.message}`);
    notify('Fatal Error', 'NFC Service stopped unexpectedly.', 'error');
});
