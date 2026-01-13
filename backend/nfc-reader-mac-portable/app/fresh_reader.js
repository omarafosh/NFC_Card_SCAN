
const { NFC } = require('nfc-pcsc');
const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const notifier = require('node-notifier');

// ---------------------------------------------------------
// 🔒 SECURE EMBEDDED CONFIGURATION
// ---------------------------------------------------------
const EMBEDDED_URL = "https://zdirmkypfxuamjbdkwhb.supabase.co";
const EMBEDDED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkaXJta3lwZnh1YW1qYmRrd2hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE1MzgxNCwiZXhwIjoyMDgxNzI5ODE0fQ.CORI1-tLzRPgdqVYxY_HX6eGDasc0l8s9muSS-eGIuk";
// ---------------------------------------------------------

// Load environment variables
config();

const CONFIG_FILE = path.join(process.cwd(), 'terminal-config.json');
const LOG_FILE = path.join(process.cwd(), 'reader.log');

// Supabase Setup
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

function notify(title, message) {
    notifier.notify({
        title: `NFC Discount - ${title}`,
        message: message,
        sound: true,
        wait: false
    });
}

function getLocalConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (e) { }
    }
    return null;
}

function saveLocalConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4));
        log('✅ Configuration saved locally.');
    } catch (e) {
        log('❌ Failed to save configuration locally.');
    }
}

async function autoEnroll() {
    console.log('🔄 Starting Auto-Enrollment...');

    // 1. Get Default Branch (first one)
    const { data: branches, error: bError } = await supabase
        .from('branches')
        .select('id, name')
        .limit(1);

    if (bError || !branches || branches.length === 0) {
        throw new Error('No branches found or connection failed.');
    }

    const defaultBranch = branches[0];
    const terminalName = `Mac-Station-${os.hostname().substring(0, 10)}`;
    const newSecret = crypto.randomUUID();

    log(`✨ Helping you setup: New Terminal "${terminalName}"`);

    // 2. Create Terminal
    const { data: newTerminal, error: iError } = await supabase
        .from('terminals')
        .insert([{
            branch_id: defaultBranch.id,
            name: terminalName,
            terminal_secret: newSecret,
            connection_url: 'auto-enroll-mac',
            is_active: true
        }])
        .select()
        .single();

    if (iError) throw iError;

    // 3. Save Config
    const newConfig = {
        id: newTerminal.id,
        branch_id: newTerminal.branch_id,
        secret: newTerminal.terminal_secret,
        name: newTerminal.name
    };

    saveLocalConfig(newConfig);
    return newConfig;
}

async function startReader() {
    console.log('\n==================================================');
    console.log('🚀 NFC Reader Station - FRESH PORTABLE v1.0');
    console.log('==================================================');

    let localConfig = getLocalConfig();

    if (!localConfig || !localConfig.id) {
        log('⚠️ No configuration found. Attempting Auto-Enrollment...');
        try {
            localConfig = await autoEnroll();
            console.log('✅ Auto-Enrollment Successful!');
        } catch (err) {
            log(`❌ Auto-Enrollment Failed: ${err.message}`);
            log('💡 Please check your internet connection or contact admin.');
            return;
        }
    }

    log(`🖥️  Terminal ID: ${localConfig.id}`);

    // Verify terminal in DB
    const { data: terminal, error } = await supabase
        .from('terminals')
        .select(`name, is_active, branch_id, branches ( name )`)
        .eq('id', localConfig.id)
        .single();

    if (error || !terminal) {
        log(`❌ Error: Terminal ID ${localConfig.id} not valid on server.`);
        return;
    }

    console.log(`📡 Connected as: ${terminal.name}`);
    console.log(`📍 Branch: ${terminal.branches?.name}`);
    console.log('==================================================\n');

    notify('Connected', `Terminal ${terminal.name} is online.`);

    // Start NFC
    const nfc = new NFC();

    nfc.on('reader', reader => {
        log(`📟 Reader connected: ${reader.name}`);
        // reader.autoProcessing = false; 
        console.log("DEBUG: Reader connected, autoProcessing is default (true)");

        reader.on('card', async card => {
            log(`💳 Card detected: ${card.uid}`);

            try {
                const { data, error } = await supabase
                    .from('scan_events')
                    .insert([{
                        terminal_id: localConfig.id,
                        branch_id: terminal.branch_id,
                        uid: card.uid
                    }]);

                if (error) throw error;
                log('✅ Scan uploaded.');
                notify('Card Scanned', `UID: ${card.uid}`);
            } catch (err) {
                log(`❌ Upload failed: ${err.message}`);
            }
        });

        reader.on('error', err => log(`❌ Reader error: ${err.message}`));
        reader.on('end', () => log(`📟 Reader removed: ${reader.name}`));
    });

    nfc.on('error', err => {
        log(`❌ NFC Service Error: ${err.message}`);
        log('💡 Is the NFC reader connected?');
    });
}

startReader().catch(err => {
    log(`💥 Fatal Error: ${err.message}`);
});
