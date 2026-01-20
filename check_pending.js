import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Fallback to trying regular .env if .env.local works differently or manually provided
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Env Vars. Please ensure .env.local exists.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    console.log('Checking pending actions...');
    const { data, error } = await supabase
        .from('terminal_actions')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No pending actions found. (Did the last one fail or complete?)');
    } else {
        console.log('------------------------------------------------');
        data.forEach(action => {
            console.log(`🆔 Action ID: ${action.id}`);
            console.log(`🎯 Target Terminal ID: ${action.terminal_id}`);
            console.log(`📝 Action Type: ${action.action_type}`);
            console.log(`⏰ Created At: ${action.created_at}`);
            console.log('------------------------------------------------');
        });
        console.log(`\n💡 Please ensure your NFC Reader script shows "Terminal ID: ${data[0].terminal_id}" at startup.`);
    }
}

check();
