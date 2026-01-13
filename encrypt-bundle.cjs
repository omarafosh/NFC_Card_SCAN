const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const password = 'nfc-super-secret-key-2025';
const key = crypto.createHash('sha256').update(password).digest();
const iv = Buffer.alloc(16, 0); // Static IV

const inputFile = path.join(process.cwd(), 'backend', 'nfc-reader-windows', 'bundle.js');
const outputFile = path.join(process.cwd(), 'backend', 'nfc-reader-windows', 'bundle.enc');

function encryptFile(inputFile, outputFile) {
    if (!fs.existsSync(inputFile)) {
        console.error('Input file not found:', inputFile);
        return;
    }
    const data = fs.readFileSync(inputFile, 'utf8');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    fs.writeFileSync(outputFile, encrypted);
    console.log(`Encrypted to ${outputFile}`);
}

encryptFile(inputFile, outputFile);
