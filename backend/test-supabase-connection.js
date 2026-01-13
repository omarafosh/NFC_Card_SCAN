// Test script to verify Supabase connection and RLS policies
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const EMBEDDED_URL = "https://zdirmkypfxuamjbdkwhb.supabase.co";
const EMBEDDED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkaXJta3lwZnh1YW1qYmRrd2hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE1MzgxNCwiZXhwIjoyMDgxNzI5ODE0fQ.CORI1-tLzRPgdqVYxY_HX6eGDasc0l8s9muSS-eGIuk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || EMBEDDED_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || EMBEDDED_KEY;

console.log('🔍 Testing Supabase Connection...\n');
console.log('URL:', supabaseUrl);
console.log('Key (first 20 chars):', supabaseKey.substring(0, 20) + '...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Test 1: Query branches
        console.log('📋 Test 1: Querying branches table...');
        const { data: branches, error: bError } = await supabase
            .from('branches')
            .select('id, name')
            .limit(5);

        if (bError) {
            console.error('❌ Error querying branches:', bError.message);
            console.error('   Details:', bError);
        } else {
            console.log('✅ Success! Found', branches?.length || 0, 'branches:');
            branches?.forEach(b => console.log(`   - ID: ${b.id}, Name: ${b.name}`));
        }
        console.log('');

        // Test 2: Query terminals
        console.log('📋 Test 2: Querying terminals table...');
        const { data: terminals, error: tError } = await supabase
            .from('terminals')
            .select('id, name, branch_id')
            .limit(5);

        if (tError) {
            console.error('❌ Error querying terminals:', tError.message);
        } else {
            console.log('✅ Success! Found', terminals?.length || 0, 'terminals:');
            terminals?.forEach(t => console.log(`   - ID: ${t.id}, Name: ${t.name}, Branch: ${t.branch_id}`));
        }
        console.log('');

        // Test 3: Try to insert a test scan event
        console.log('📋 Test 3: Testing scan_events insert permission...');
        const { data: scanTest, error: sError } = await supabase
            .from('scan_events')
            .insert([{
                terminal_id: 1,
                branch_id: 1,
                uid: 'TEST-' + Date.now(),
                processed: true
            }])
            .select();

        if (sError) {
            console.error('❌ Error inserting scan event:', sError.message);
        } else {
            console.log('✅ Success! Scan event inserted:', scanTest?.[0]?.id);

            // Clean up test event
            await supabase.from('scan_events').delete().eq('id', scanTest[0].id);
            console.log('   (Test event cleaned up)');
        }
        console.log('');

        // Summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Summary:');
        console.log('   Branches query:', bError ? '❌ FAILED' : '✅ PASSED');
        console.log('   Terminals query:', tError ? '❌ FAILED' : '✅ PASSED');
        console.log('   Scan events insert:', sError ? '❌ FAILED' : '✅ PASSED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (!bError && !tError && !sError) {
            console.log('\n🎉 All tests passed! The NFC script should work now.');
        } else {
            console.log('\n⚠️  Some tests failed. RLS policies may need adjustment.');
        }

    } catch (err) {
        console.error('💥 Fatal error:', err.message);
        console.error(err);
    }
}

testConnection();
