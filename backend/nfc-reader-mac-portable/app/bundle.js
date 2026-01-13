
const { NFC } = require('nfc-pcsc');
const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const notifier = require('node-notifier');

// 🔒 CONFIGURATION
const EMBEDDED_URL = "https://zdirmkypfxuamjbdkwhb.supabase.co";
const EMBEDDED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkaXJta3lwZnh1YW1qYmRrd2hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE1MzgxNCwiZXhwIjoyMDgxNzI5ODE0fQ.CORI1-tLzRPgdqVYxY_HX6eGDasc0l8s9muSS-eGIuk";

config();

const CONFIG_FILE = path.join(process.cwd(), 'terminal-config.json');
const LOG_FILE = path.join(process.cwd(), 'reader.log');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || EMBEDDED_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || EMBEDDED_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  try { fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`); } catch (e) { }
}

function notify(title, message) {
  notifier.notify({ title: `NFC Discount - ${title}`, message: message, sound: true });
}

function getLocalConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) { }
  }
  return null;
}

function saveLocalConfig(config) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4)); } catch (e) { }
}

async function autoEnroll() {
  log('🔄 Auto-Enrolling Terminal...');
  const { data: branches } = await supabase.from('branches').select('id').limit(1);
  if (!branches?.length) throw new Error('No branches found');

  const termName = `Mac-${os.hostname().substring(0, 10)}`;
  const { data: term, error } = await supabase.from('terminals').insert([{
    branch_id: branches[0].id,
    name: termName,
    terminal_secret: crypto.randomUUID(),
    connection_url: 'mac-auto',
    is_active: true
  }]).select().single();

  if (error) throw error;
  const cfg = { id: term.id, branch_id: term.branch_id, secret: term.terminal_secret };
  saveLocalConfig(cfg);
  return cfg;
}

// MAIN READER LOGIC
async function run() {
  console.log('🚀 STARING NFC READER (Production Mode)...');

  let config = getLocalConfig();
  if (!config?.id) {
    try { config = await autoEnroll(); }
    catch (e) { log(`❌ Setup Failed: ${e.message}`); return; }
  }

  log(`✅ Terminal ID: ${config.id}`);

  // Check DB
  const { data: term } = await supabase.from('terminals').select('name, is_active').eq('id', config.id).single();
  if (term) log(`📡 Online as: ${term.name}`);

  const nfc = new NFC();

  nfc.on('reader', reader => {
    log(`📟 Reader Attached: ${reader.name}`);
    reader.autoProcessing = true; // Use standard processing

    reader.on('card', async card => {
      console.log('--------------------------------------------------');
      log(`💳 CARD TAPPED! UID: ${card.uid}`);
      console.log('   Full Data:', JSON.stringify(card));
      notify('Card Scanned', `UID: ${card.uid}`);

      try {
        const { error } = await supabase.from('scan_events').insert([{
          terminal_id: config.id,
          branch_id: config.branch_id, // stored in local config
          uid: card.uid
        }]);
        if (error) throw error;
        log('   ✅ Uploaded to Cloud');
      } catch (e) {
        log(`   ❌ Upload Failed: ${e.message}`);
      }
    });

    reader.on('error', err => log(`⚠️ Reader Error: ${err.message}`));
    reader.on('end', () => log(`📟 Reader Removed`));
  });

  nfc.on('error', err => log(`❌ Service Error: ${err.message}`));
}

run();
