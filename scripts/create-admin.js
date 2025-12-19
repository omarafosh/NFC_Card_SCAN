#!/usr/bin/env node

/**
 * Create Admin User Script
 * 
 * This script creates the first admin user for the NFC Discount System.
 * Use this for initial setup in production instead of auto-creation.
 * 
 * Usage:
 *   node scripts/create-admin.js
 * 
 * You will be prompted for username and password.
 */

import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import readline from 'readline';
import { config } from 'dotenv';

// Load environment variables
config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
    console.log('🔐 NFC Discount System - Create Admin User\n');

    try {
        // Connect to database
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'nfc_discount_system',
        });

        console.log('✅ Connected to database\n');

        // Check if admin already exists
        const [existingAdmins] = await connection.query(
            'SELECT COUNT(*) as count FROM users WHERE role = ?',
            ['admin']
        );

        if (existingAdmins[0].count > 0) {
            console.log('⚠️  Warning: Admin users already exist in the database.');
            const confirm = await question('Do you want to create another admin? (yes/no): ');
            if (confirm.toLowerCase() !== 'yes') {
                console.log('Operation cancelled.');
                await connection.end();
                rl.close();
                return;
            }
        }

        // Get username
        let username = await question('Enter admin username: ');
        username = username.trim();

        if (!username || username.length < 3) {
            console.error('❌ Username must be at least 3 characters long.');
            await connection.end();
            rl.close();
            return;
        }

        // Check if username exists
        const [existingUser] = await connection.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUser.length > 0) {
            console.error('❌ Username already exists. Please choose a different username.');
            await connection.end();
            rl.close();
            return;
        }

        // Get password
        let password = await question('Enter admin password (min 8 characters): ');

        if (!password || password.length < 8) {
            console.error('❌ Password must be at least 8 characters long.');
            await connection.end();
            rl.close();
            return;
        }

        // Confirm password
        const confirmPassword = await question('Confirm password: ');

        if (password !== confirmPassword) {
            console.error('❌ Passwords do not match.');
            await connection.end();
            rl.close();
            return;
        }

        // Hash password
        console.log('\n🔄 Creating admin user...');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert admin user
        const [result] = await connection.query(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, hashedPassword, 'admin']
        );

        console.log(`✅ Admin user created successfully!`);
        console.log(`   Username: ${username}`);
        console.log(`   User ID: ${result.insertId}`);
        console.log(`   Role: admin\n`);
        console.log('🎉 You can now login with these credentials.\n');

        await connection.end();
        rl.close();

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Run the script
createAdmin();
