import { config } from 'dotenv';

// Load environment variables
config();

// Configuration - Matches the seed data
const API_URL = process.env.API_URL || 'http://localhost:3000/api/scan/ingest';
const TERMINAL_ID = process.env.TERMINAL_ID || 1;
const TERMINAL_SECRET = process.env.TERMINAL_SECRET || 'your-terminal-secret';

async function simulateScan(uid) {
    console.log(`[Simulator] Simulating scan for UID: ${uid}`);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                terminal_id: TERMINAL_ID,
                terminal_secret: TERMINAL_SECRET,
                uid: uid
            })
        });

        const data = await response.json();
        if (response.status === 401) {
            console.error('\n❌ [Simulator] Error: Unauthorized Terminal');
            console.log('💡 Tip: Go to the "Management" (الإدارة) page -> "Terminals" tab in your browser.');
            console.log('   Copy the "Secret" for your terminal and paste it in your .env file as TERMINAL_SECRET.\n');
        } else {
            console.log('[Simulator] Server Response:', data);
        }
    } catch (error) {
        console.error('[Simulator] Connection Error:', error.message);
    }
}

// Simulate a scan after 2 seconds
setTimeout(() => simulateScan('ABC123456789'), 2000);
