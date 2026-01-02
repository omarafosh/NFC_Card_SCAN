import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist-reader');
const nodeModulesDir = path.join(process.cwd(), 'node_modules');

// 1. Create structure
const dirs = [
    distDir,
    path.join(distDir, 'node_modules/@pokusew/pcsclite/build/Release'),
    path.join(distDir, 'vendor')
];

dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

// 2. Copy EXE
fs.copyFileSync('nfc-reader.exe', path.join(distDir, 'nfc-reader.exe'));

// 3. Copy Native Module
const nativeSource = path.join(nodeModulesDir, '@pokusew/pcsclite/build/Release/pcsclite.node');
const nativeDest = path.join(distDir, 'node_modules/@pokusew/pcsclite/build/Release/pcsclite.node');
if (fs.existsSync(nativeSource)) {
    fs.copyFileSync(nativeSource, nativeDest);
    console.log('✅ Copied native module: pcsclite.node');
} else {
    console.warn('⚠️ Native module not found at', nativeSource);
}

// 4. Copy Notifier Vendors (Windows only for now)
const notifierSource = path.join(nodeModulesDir, 'node-notifier/vendor/snoreToast/snoretoast-x64.exe');
const notifierDest = path.join(distDir, 'vendor/snoretoast-x64.exe');
if (fs.existsSync(notifierSource)) {
    fs.copyFileSync(notifierSource, notifierDest);
    console.log('✅ Copied notifier vendor: snoretoast');
}

// 5. Create a Readme/Instructions
const readme = `
# NFC Reader Service - Ready to Fly! 🚀

## Setup
1. Edit 'terminal-config.json' and add your Terminal ID and Branch ID.
2. Run 'nfc-reader.exe'.
3. Allow Windows Notification if prompted.

## Auto-start
To start with Windows:
1. Press Win+R, type 'shell:startup' and hit Enter.
2. Right-click 'nfc-reader.exe' -> Create Shortcut.
3. Move the shortcut to the Startup folder.
`;

fs.writeFileSync(path.join(distDir, 'INSTRUCTIONS.txt'), readme);

console.log(`\n🎉 Distribution assembled in ${distDir}`);
