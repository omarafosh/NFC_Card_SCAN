// Simplified NFC Reader Test - To identify exact failure point
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import os from 'os';
import crypto from 'crypto';

config();

const EMBEDDED_URL = "https://zdirmkypfxuamjbdkwhb.supabase.co";
const EMBEDDED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkaXJta3lwZnh1YW1qYmRrd2hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE1MzgxNCwiZXhwIjoyMDgxNzI5ODE0fQ.CORI1-tLzRPgdqVYxY_HX6eGDasc0l8s9muSS-eGIuk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || EMBEDDED_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || EMBEDDED_KEY;

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 NFC Reader Enrollment Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEnrollment() {
    try {
        console.log('Step 1: Fetching branches...');
        const { data: branches, error: bError } = await supabase
            .from('branches')
            .select('id, name')
            .limit(1);

        console.log('   Response:', { branches, error: bError?.message });

        if (bError) {
            console.error('❌ Failed at Step 1:', bError.message);
            console.error('   Full error:', bError);
            return;
        }

        if (!branches || branches.length === 0) {
            console.error('❌ No branches found in database!');
            console.log('   This is the exact error the NFC script encounters.');
            return;
        }

        console.log('✅ Step 1 passed! Found branch:', branches[0]);
        console.log('');

        const defaultBranch = branches[0];
        const newSecret = crypto.randomUUID();
        const terminalName = `Test-Station-${os.hostname().substring(0, 10)}`;

        console.log('Step 2: Creating terminal...');
        console.log('   Name:', terminalName);
        console.log('   Branch ID:', defaultBranch.id);
        console.log('   Secret:', newSecret.substring(0, 20) + '...');

        const { data: newTerminal, error: iError } = await supabase
            .from('terminals')
            .insert([{
                branch_id: defaultBranch.id,
                name: terminalName,
                terminal_secret: newSecret,
                connection_url: 'test-enrollment',
                is_active: true
            }])
            .select()
            .single();

        if (iError) {
            console.error('❌ Failed at Step 2:', iError.message);
            console.error('   Full error:', iError);
            return;
        }

        console.log('✅ Step 2 passed! Terminal created:', newTerminal);
        console.log('');

        console.log('Step 3: Cleaning up test terminal...');
        await supabase.from('terminals').delete().eq('id', newTerminal.id);
        console.log('✅ Cleanup complete');
        console.log('');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 SUCCESS! Enrollment process works correctly.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n💡 The Mac NFC script should work now.');
        console.log('   If it still fails, the issue is in the bundled code.');

    } catch (err) {
        console.error('💥 Unexpected error:', err.message);
        console.error(err);
    }
}

testEnrollment();
