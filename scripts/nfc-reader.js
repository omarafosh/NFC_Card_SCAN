import { NFC } from 'nfc-pcsc';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Load environment variables
config();

const CONFIG_FILE = path.join(process.cwd(), '.terminal-config.json');

// Supabase Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function getTerminalConfig() {
    // 1. Try to load from file
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (fileConfig.TERMINAL_ID && fileConfig.BRANCH_ID) {
                return fileConfig;
            }
        } catch (e) {
            console.error('⚠️  Error reading config file, recreating...');
        }
    }

    // 2. Fallback to .env (Legacy support)
    if (process.env.TERMINAL_ID && process.env.BRANCH_ID) {
        return {
            TERMINAL_ID: parseInt(process.env.TERMINAL_ID),
            BRANCH_ID: parseInt(process.env.BRANCH_ID)
        };
    }

    // 3. Ask user (First run setup)
    console.log('\n⚙️  First Time Setup');
    console.log('--------------------------------------------------');

    // Fetch available branches (Optional, for better UX)
    // For now, simple input

    const branchId = await question('🏢 Enter Branch ID (default 1): ') || '1';
    const terminalId = await question('📍 Enter Terminal ID (e.g. 1, 2, 3): ');

    if (!terminalId) {
        console.error('❌ Terminal ID is required!');
        process.exit(1);
    }

    const newConfig = {
        TERMINAL_ID: parseInt(terminalId),
        BRANCH_ID: parseInt(branchId)
    };

    // Save to file
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    console.log(`✅ Configuration saved to ${CONFIG_FILE}\n`);

    return newConfig;
}

(async () => {
    const { TERMINAL_ID, BRANCH_ID } = await getTerminalConfig();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 NFC Reader - Supabase Realtime Edition');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📍 Terminal ID: ${TERMINAL_ID}`);
    console.log(`🏢 Branch ID:   ${BRANCH_ID}`);
    console.log(`🔗 Supabase:    ${supabaseUrl}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Initialize NFC
    console.log('[NFC] Initializing PC/SC reader...');
    const nfc = new NFC();

    nfc.on('reader', (reader) => {
        console.log(`\n✅ [NFC] Reader detected: ${reader.name}`);
        console.log('[NFC] Waiting for cards...\n');

        reader.on('card', async (card) => {
            const uid = card.uid;

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🔔 [CARD DETECTED]`);
            console.log(`   UID: ${uid}`);
            console.log(`   Time: ${new Date().toLocaleString()}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            try {
                const { data, error } = await supabase
                    .from('scan_events')
                    .insert([{
                        terminal_id: TERMINAL_ID,
                        branch_id: BRANCH_ID,
                        uid: uid,
                        processed: false
                    }]);

                if (error) {
                    console.error('❌ [Supabase] Error:', error.message);
                } else {
                    console.log(`✅ [Supabase] Broadcasted successfully for Terminal ${TERMINAL_ID}`);
                }
            } catch (err) {
                console.error('❌ [Error]', err.message);
            }
        });

        reader.on('card.off', () => {
            // console.log('📤 [NFC] Card removed'); 
        });

        reader.on('error', (err) => {
            console.error(`❌ [NFC] Reader error:`, err.message);
        });

        reader.on('end', () => {
            console.log(`\n⚠️  [NFC] Reader disconnected: ${reader.name}`);
        });
    });

    nfc.on('error', (err) => {
        console.error('\n❌ [NFC] Error:', err.message);
    });

    // Handle Ctrl+C to close readline cleanly if it's open (though we await close above)
    // But mainly to keep process alive
})();
