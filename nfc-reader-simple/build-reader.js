const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');
require('dotenv').config();

// Configuration
const SOURCE_FILE = 'reader.js';
const TEMP_BUILD_FILE = 'reader-build.js';
const OUTPUT_DIR = 'dist';

console.log('🏗️  Starting Secure Build Process...');

// 1. Check for Config
// GitHub Actions provides these via process.env
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const terminalId = process.env.TERMINAL_ID;

if (!supabaseUrl || !supabaseKey || !terminalId) {
    console.error('❌ Error: Missing Configuration!');
    console.error('Debug:', { url: !!supabaseUrl, key: !!supabaseKey, tid: !!terminalId });
    process.exit(1);
}

// 2. Read Source Code
let sourceCode = fs.readFileSync(path.join(__dirname, SOURCE_FILE), 'utf8');

// 3. Inject Secrets (Replace process.env calls)
console.log('🔒 Injecting secrets into build...');
sourceCode = sourceCode.replace(/process\.env\.SUPABASE_URL/g, `'${supabaseUrl}'`);
sourceCode = sourceCode.replace(/process\.env\.SUPABASE_SERVICE_KEY/g, `'${supabaseKey}'`);
sourceCode = sourceCode.replace(/process\.env\.TERMINAL_ID/g, `'${terminalId}'`);

// Remove dotenv requirement since we baked in the values
sourceCode = sourceCode.replace("require('dotenv').config();", "");

// 4. Obfuscate Code
console.log('🌪️  Obfuscating code...');
const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    numbersToExpressions: true,
    simplify: true,
    stringArrayShuffle: true,
    splitStrings: true,
    stringArrayThreshold: 1,
    ignoreRequireImports: true
});

let finalCode = obfuscationResult.getObfuscatedCode();

// ALERT: Append dummy requires so 'pkg' can see them statically
// The obfuscator hides them, so pkg thinks we don't need them.
// We add them here in a dead code block.
finalCode += `
/* Pkg Hints */
if (false) {
    require('nfc-pcsc');
    require('@supabase/supabase-js');
    require('node-notifier');
    require('readline');
    require('events');
    require('buffer');
}
`;

fs.writeFileSync(TEMP_BUILD_FILE, finalCode);

// 5. Package with Pkg
console.log('📦 Packaging executables (this may take a while)...');
try {
    // Determine targets
    const platform = process.platform;
    let target = '';

    if (platform === 'win32') {
        target = 'node18-win-x64';
        console.log('🛠️  Windows detected. Rebuilding native modules for Node 18...');
        try {
            execSync('npm rebuild --target=18.5.0 --runtime=node --arch=x64', { stdio: 'inherit' });
        } catch (e) {
            console.warn('⚠️  Rebuild warning:', e.message);
        }
    } else if (platform === 'darwin') {
        const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
        target = `node18-macos-${arch}`;
        console.log(`🍎 MacOS (${arch}) detected. Rebuilding native modules for Node 18...`);
        try {
            execSync(`npm rebuild --target=18.5.0 --runtime=node --arch=${arch}`, { stdio: 'inherit' });
        } catch (e) {
            console.warn('⚠️  Rebuild warning:', e.message);
        }
    } else {
        console.log('🐧 Linux/Other detected. Using standard Node 18 target...');
        target = 'node18-linux-x64';
        try {
            execSync('npm rebuild --target=18.5.0 --runtime=node', { stdio: 'inherit' });
        } catch (e) {
            console.warn('⚠️  Rebuild warning:', e.message);
        }
    }

    // Command to run pkg
    // We use npx to run it from local modules
    // We use --config package.json to ensure assets are included
    execSync(`npx pkg ${TEMP_BUILD_FILE} --config package.json --targets ${target} --out-path ${OUTPUT_DIR}`, {
        stdio: 'inherit'
    });

    console.log('✅ Build Successful!');
    console.log(`📂 Output: ${path.resolve(__dirname, OUTPUT_DIR)}`);
} catch (error) {
    console.error('❌ Build Failed:', error.message);
} finally {
    // 6. Cleanup
    console.log('🧹 Cleaning up temporary files...');
    if (fs.existsSync(TEMP_BUILD_FILE)) {
        fs.unlinkSync(TEMP_BUILD_FILE);
    }
}
