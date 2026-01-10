const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBranchesDetailed() {
    try {
        const { data: allBranches, error } = await supabase.from('branches').select('*');
        if (error) throw error;

        console.log('--- Detailed Branch Audit ---');
        console.table(allBranches.map(b => ({
            id: b.id,
            name: b.name,
            deleted_at: b.deleted_at,
            is_active: b.is_active
        })));

        const active = allBranches.filter(b => !b.deleted_at);
        console.log(`Active (not deleted) branches: ${active.length}`);
    } catch (err) {
        console.error(err);
    }
}

checkBranchesDetailed();
