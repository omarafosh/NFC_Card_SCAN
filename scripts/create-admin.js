#!/usr/bin/env node

/**
 * Create Admin User Script (Supabase Version)
 * 
 * This script creates the first admin user for the NFC Discount System in Supabase.
 */

import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
    console.log('🔐 NFC Discount System - Create Admin User (Supabase)\n');

    try {
        console.log('✅ Connecting to Supabase...');

        // Check if admin already exists
        const { count, error: countError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'admin');

        if (countError) throw countError;

        if (count > 0) {
            console.log('⚠️  Warning: Admin users already exist in the database.');
            const confirm = await question('Do you want to create another admin? (yes/no): ');
            if (confirm.toLowerCase() !== 'yes') {
                console.log('Operation cancelled.');
                rl.close();
                return;
            }
        }

        // Get username
        let username = await question('Enter admin username: ');
        username = username.trim();

        if (!username || username.length < 3) {
            console.error('❌ Username must be at least 3 characters long.');
            rl.close();
            return;
        }

        // Check if username exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingUser) {
            console.error('❌ Username already exists. Please choose a different username.');
            rl.close();
            return;
        }

        // Get password
        let password = await question('Enter admin password (min 8 characters): ');

        if (!password || password.length < 8) {
            console.error('❌ Password must be at least 8 characters long.');
            rl.close();
            return;
        }

        // Confirm password
        const confirmPassword = await question('Confirm password: ');

        if (password !== confirmPassword) {
            console.error('❌ Passwords do not match.');
            rl.close();
            return;
        }

        // Hash password
        console.log('\n🔄 Creating admin user...');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert admin user
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([
                { username, password_hash: hashedPassword, role: 'admin' }
            ])
            .select()
            .single();

        if (insertError) throw insertError;

        console.log(`✅ Admin user created successfully!`);
        console.log(`   Username: ${username}`);
        console.log(`   User ID: ${newUser.id}`);
        console.log(`   Role: admin\n`);
        console.log('🎉 You can now login with these credentials.\n');

        rl.close();

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Run the script
createAdmin();
