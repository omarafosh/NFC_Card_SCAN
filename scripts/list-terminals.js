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
    console.log('📋 Existing Terminals & Secrets:\n');
    console.log('--------------------------------------------------');

    const { data, error } = await supabase
        .from('terminals')
        .select('id, name, terminal_secret');

    if (error) {
        console.error('❌ Error fetching terminals:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️  No terminals found. Did you run the seed script?');
    } else {
        data.forEach(t => {
            console.log(`ID: ${t.id} | Name: ${t.name}`);
            console.log(`SECRET: ${t.terminal_secret}`);
            console.log('--------------------------------------------------');
        });
        console.log('\n💡 Copy the ID and SECRET above and update your .env file.');
    }
}

listTerminals();
