const fs = require('fs');
const crypto = require('crypto');

const secret = 'nfc-super-secret-key-2025';

function encryptFile(inputFile, outputFile) {
    const data = fs.readFileSync(inputFile, 'utf8');
    const cipher = crypto.createCipher('aes-256-cbc', secret);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    fs.writeFileSync(outputFile, encrypted);
    console.log(`Encrypted ${inputFile} to ${outputFile}`);
}

encryptFile('backend/nfc-reader-windows/bundle.js', 'backend/nfc-reader-windows/bundle.enc');
