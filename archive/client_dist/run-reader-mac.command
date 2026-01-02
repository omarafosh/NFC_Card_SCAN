#!/bin/bash

echo "=========================================="
echo "      NFC Discount System Middleware"
echo "=========================================="
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null
then
    echo "Error: Node.js is not installed!"
    echo "Please download it from https://nodejs.org/"
    exit 1
fi

# 2. Install dependencies
if [ ! -d "node_modules" ]; then
    echo "[Setup] Installing dependencies..."
    npm install
    npm install nfc-pcsc
    echo "[Setup] Complete!"
fi

# 3. Run Reader loop
echo "[System] Starting NFC Reader Service..."
echo "[System] Press Ctrl+C to stop."
echo ""

while true; do
    npm run reader
    echo "[Warning] Reader stopped. Restarting in 3s..."
    sleep 3
done
