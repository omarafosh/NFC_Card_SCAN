const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from root
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function ensureDefaultBranch() {
    try {
        console.log('Checking branches...');
        const { data: branches, error: bError } = await supabase.from('branches').select('id, name');

        if (bError) throw bError;

        if (!branches || branches.length === 0) {
            console.log('No branches found. Creating default "المحل الرئيسي"...');
            const { error: iError } = await supabase.from('branches').insert([
                { name: 'المحل الرئيسي', location: 'Main' }
            ]);
            if (iError) throw iError;
            console.log('✅ Default branch created successfully.');
        } else {
            console.log(`✅ Branches exist: ${branches.map(b => b.name).join(', ')}`);
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

ensureDefaultBranch();
