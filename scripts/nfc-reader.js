import { NFC } from 'nfc-pcsc';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------
// 🔒 SECURE EMBEDDED CONFIGURATION (DO NOT SHARE SOURCE)
// ---------------------------------------------------------
const EMBEDDED_URL = "https://zdirmkypfxuamjbdkwhb.supabase.co";
const EMBEDDED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkaXJta3lwZnh1YW1qYmRrd2hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE1MzgxNCwiZXhwIjoyMDgxNzI5ODE0fQ.CORI1-tLzRPgdqVYxY_HX6eGDasc0l8s9muSS-eGIuk";
// ---------------------------------------------------------

// Optional dependency
let notifier = null;
try {
    import('node-notifier').then(m => {
        notifier = m.default;
    }).catch(() => { });
} catch (e) { }

// Load environment variables for local overrides if needed
config();

const CONFIG_FILE = path.join(process.cwd(), 'terminal-config.json');
const LOG_FILE = path.join(process.cwd(), 'reader.log');

// Supabase Configuration priority: ENV -> EMBEDDED
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || EMBEDDED_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || EMBEDDED_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase credentials missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function log(message) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${message}`;
    console.log(formatted);
    try {
        fs.appendFileSync(LOG_FILE, formatted + '\n');
    } catch (e) { }
}

function notify(title, message, iconType = 'info') {
    if (notifier) {
        notifier.notify({
            title: `NFC Discount - ${title}`,
            message: message,
            sound: true,
            wait: false
        });
    }
}

function getTerminalConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (e) {
            log('⚠️ Error reading config file.');
        }
    }
    return {
        id: process.env.TERMINAL_ID || 1,
        branch_id: process.env.BRANCH_ID || 1,
        secret: process.env.TERMINAL_SECRET || ''
    };
}

async function startReader() {
    const localConfig = getTerminalConfig();

    console.log('\n==================================================');
    console.log('🚀 NFC Reader Station - DYNAMIC VERSION v0.2.1');
    console.log('==================================================');
    console.log(`🖥️  Local Identifier (ID): ${localConfig.id}`);

    // Verify terminal exists and fetch latest metadata from Database
    const { data: terminal, error } = await supabase
        .from('terminals')
        .select(`
            name, 
            is_active, 
            branch_id,
            branches ( name )
        `)
        .eq('id', localConfig.id)
        .single();

    if (error || !terminal) {
        log(`❌ Error: Terminal ${localConfig.id} not found in database.`);
        return;
    }

    if (!terminal.is_active) {
        log(`❌ Warning: Terminal "${terminal.name}" is deactivated in dashboard.`);
        return;
    }

    const branchName = terminal.branches?.name || 'Unknown Branch';
    const activeBranchId = terminal.branch_id;

    console.log(`📡 Connected as: ${terminal.name}`);
    console.log(`📍 Assigned Branch: ${branchName} (ID: ${activeBranchId})`);
    console.log('==================================================\n');

    log(`✅ System Ready at ${branchName}`);
    notify('Connected', `Terminal ${terminal.name} is now online.`);

    // Heartbeat logic
    setInterval(async () => {
        const { error } = await supabase
            .from('terminals')
            .update({ last_sync: new Date().toISOString() })
            .eq('id', localConfig.id);

        if (error) log('⚠️ Heartbeat failed');
    }, 60000); // Every minute

    const nfc = new NFC();

    nfc.on('reader', reader => {
        log(`📟 Reader connected: ${reader.name}`);

        reader.on('card', async card => {
            log(`💳 Card detected: ${card.uid}`);

            try {
                // Ingest scan event
                const { data, error } = await supabase
                    .from('scan_events')
                    .insert([{
                        terminal_id: localConfig.id,
                        branch_id: activeBranchId,
                        uid: card.uid
                    }])
                    .select();

                if (error) throw error;

                log('✅ Scan event sent successfully');
                notify('Card Scanned', `Card ${card.uid} processed.`);
            } catch (err) {
                log(`❌ Error processing scan: ${err.message}`);
                notify('Scan Error', 'Failed to process card.');
            }
        });

        reader.on('error', err => {
            log(`❌ Reader error: ${err.message}`);
        });

        reader.on('end', () => {
            log(`📟 Reader disconnected: ${reader.name}`);
        });
    });

    nfc.on('error', err => {
        log(`❌ NFC Error: ${err.message}`);
    });
}

// Start the reader
startReader().catch(err => {
    log(`💥 Fatal error: ${err.message}`);
    process.exit(1);
});
