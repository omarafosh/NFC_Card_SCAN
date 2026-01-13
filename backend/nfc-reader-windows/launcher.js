const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const password = 'nfc-super-secret-key-2025';
const key = crypto.createHash('sha256').update(password).digest();
const iv = Buffer.alloc(16, 0);

// Force pkg to include native modules
if (false) {
    require('nfc-pcsc');
    require('dotenv');
    require('chalk');
    require('boxen');
    require('ora');
    require('@supabase/supabase-js');
}

// In pkg, assets are readable via fs.readFileSync inside snapshot
// We assume bundle.enc is in the same directory as the executable (or packed inside)
const encryptedPath = path.join(__dirname, 'bundle.enc');

try {
    const encryptedData = fs.readFileSync(encryptedPath, 'utf8');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Execute the decrypted code
    // We modify process.argv so the bundle thinks it's being run directly
    // This helps libraries like yargs or commander if used

    // Using Module._compile to run it as if it were a real file
    const Module = module.constructor;
    const m = new Module();
    m.paths = module.paths;
    m._compile(decrypted, "bundle.js");

} catch (e) {
    console.error("Failed to launch secure terminal:", e.message);
    process.exit(1);
}
