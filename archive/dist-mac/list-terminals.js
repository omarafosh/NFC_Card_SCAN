import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTerminals() {
    console.log('\n📋 Existing Terminals & Secrets:\n');
    console.log('--------------------------------------------------------------------------------');
    console.log(String('ID').padEnd(5) + ' | ' + String('Name').padEnd(25) + ' | ' + String('Status').padEnd(10) + ' | ' + 'Last Seen');
    console.log('--------------------------------------------------------------------------------');

    const { data, error } = await supabase
        .from('terminals')
        .select('id, name, terminal_secret, last_sync');

    if (error) {
        console.error('❌ Error fetching terminals:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️  No terminals found.');
    } else {
        data.forEach(t => {
            const lastSync = t.last_sync ? new Date(t.last_sync) : null;
            const now = new Date();
            const isOnline = lastSync && (now - lastSync) < 10 * 60 * 1000; // 10 minutes threshold

            const status = isOnline ? '🟢 ONLINE' : '⚪ OFFLINE';
            const lastSeenStr = lastSync ? lastSync.toLocaleString() : 'Never';

            console.log(
                String(t.id).padEnd(5) + ' | ' +
                String(t.name).padEnd(25) + ' | ' +
                String(status).padEnd(10) + ' | ' +
                lastSeenStr
            );
            console.log(`   SECRET: ${t.terminal_secret}`);
            console.log('--------------------------------------------------------------------------------');
        });
        console.log('\n💡 Tip: To connect a specific machine, set TERMINAL_ID in your config to match the ID above.');
    }
}

listTerminals();
