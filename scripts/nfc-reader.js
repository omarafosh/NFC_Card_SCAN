import { NFC } from 'nfc-pcsc';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Optional dependency
let notifier = null;
try {
    import('node-notifier').then(m => {
        notifier = m.default;
    }).catch(() => {
        // Silently fail if not found
    });
} catch (e) { }

// Load environment variables
config();

const CONFIG_FILE = path.join(process.cwd(), 'terminal-config.json');
const LOG_FILE = path.join(process.cwd(), 'reader.log');

// Supabase Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    log('❌ Error: Supabase credentials missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function log(message) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${message}`;
    console.log(formatted);
    try {
        fs.appendFileSync(LOG_FILE, formatted + '\n');
    } catch (e) { }
}

function notify(title, message, iconType = 'info') {
    if (notifier) {
        notifier.notify({
            title: `NFC Discount - ${title}`,
            message: message,
            sound: true,
            wait: false
        });
    }
}

function getTerminalConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (e) {
            log('⚠️ Error reading config file.');
        }
    }

    // Default if no file (for first run or env backup)
    return {
        TERMINAL_ID: parseInt(process.env.TERMINAL_ID) || null,
        BRANCH_ID: parseInt(process.env.BRANCH_ID) || null,
        SECRET: process.env.TERMINAL_SECRET || null
    };
}

async function syncTerminalStatus(terminalId) {
    try {
        const { data, error } = await supabase
            .from('terminals')
            .update({
                last_sync: new Date().toISOString(),
                is_active: true
            })
            .eq('id', terminalId)
            .select();

        if (error || !data?.[0]) {
            log(`⚠️ Terminal ID ${terminalId} not verified.`);
            return false;
        }
        return data[0];
    } catch (err) {
        log(`❌ Sync Error: ${err.message}`);
        return false;
    }
}

async function startReader() {
    const currentConfig = getTerminalConfig();

    if (!currentConfig.TERMINAL_ID) {
        log('❌ خطأ: رقم الجهاز (TERMINAL_ID) مفقود. يرجى ضبطه في terminal-config.json');
        notify('خطأ في الإعدادات', 'رقم الجهاز مفقود!', 'error');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 NFC Reader - نظام السحب والخصم الاحترافي');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📍 رقم الجهاز (Terminal ID): ${currentConfig.TERMINAL_ID}`);
    console.log(`🏢 رقم الفرع (Branch ID):   ${currentConfig.BRANCH_ID || 'غير محدد'}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    log(`🔍 جاري التحقق من اتصال الجهاز رقم ${currentConfig.TERMINAL_ID} بالخادم...`);

    const terminal = await syncTerminalStatus(currentConfig.TERMINAL_ID);
    if (terminal) {
        console.log(`✅ تم الاتصال بنجاح!`);
        console.log(`🖥️  اسم الجهاز في النظام: "${terminal.name}"`);
        console.log(`🌐 الفرع: ${terminal.branch_id || 'افتراضي'}`);
        console.log('═══════════════════════════════════════════════════════════\n');

        notify('جاهز للعمل', `الجهاز "${terminal.name}" متصل الآن بالخادم.`);
    } else {
        console.warn(`⚠️  تحذير: لم يتم العثور على هذا الجهاز في لوحة التحكم.`);
        console.warn(`   تأكد من إضافة الجهاز رقم (${currentConfig.TERMINAL_ID}) في قسم الإدارة أولاً.`);
    }

    const nfc = new NFC();

    nfc.on('reader', (reader) => {
        log(`🟢 تم العثور على قارئ البطاقات: ${reader.name}`);

        reader.on('card', async (card) => {
            const uid = card.uid;
            log(`💳 تم مسح بطاقة جديدة: ${uid}`);

            try {
                const { error } = await supabase
                    .from('scan_events')
                    .insert([{
                        terminal_id: currentConfig.TERMINAL_ID,
                        branch_id: currentConfig.BRANCH_ID,
                        uid: uid,
                        processed: false
                    }]);

                if (error) throw error;

                log('✅ تم إرسال البيانات للخادم بنجاح.');
                notify('تم المسح', `تم قراءة البطاقة ${uid} وإرسالها.`);

                // Update terminal heartbeat
                await supabase
                    .from('terminals')
                    .update({ last_sync: new Date().toISOString() })
                    .eq('id', currentConfig.TERMINAL_ID);

            } catch (err) {
                log(`❌ فشل إرسال البيانات: ${err.message}`);
                notify('فشل الإرسال', 'يرجى التحقق من اتصال الإنترنت.', 'error');
            }
        });

        reader.on('error', (err) => log(`⚠️ خطأ في القارئ: ${err.message}`));
        reader.on('end', () => log(`🔴 تم فصل القارئ: ${reader.name}`));
    });

    nfc.on('error', (err) => log(`❌ خطأ في مدير NFC: ${err.message}`));

    // Heartbeat loop (every 5 minutes)
    setInterval(async () => {
        await supabase
            .from('terminals')
            .update({ last_sync: new Date().toISOString() })
            .eq('id', currentConfig.TERMINAL_ID);
        log('💓 تم تحديث حالة الاتصال (Heartbeat).');
    }, 5 * 60 * 1000);
}

startReader().catch(err => {
    log(`💥 Fatal Error: ${err.message}`);
    notify('Fatal Error', 'NFC Service stopped unexpectedly.', 'error');
});
