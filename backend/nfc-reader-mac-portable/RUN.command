#!/bin/bash
# NFC Reader v25 [PROFESSIONAL PORTABLE MAC]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

clear
echo "════════════════════════════════════════"
echo "   NFC Reader - Version 25 (Professional)"
echo "   Portable macOS Runtime Environment"
echo "════════════════════════════════════════"
echo ""

# Remove quarantine (Security bypass)
echo "🔓 Preparing security permissions..."
xattr -cr . 2>/dev/null || true

# Define paths
NODE_RUNTIME="./runtime/node"
APP_BUNDLE="./app/bundle.js"

# Check for portable runtime
if [ ! -f "$NODE_RUNTIME" ]; then
    echo "⚠️  Portable runtime not found in ./runtime/node"
    echo "⏳ Attempting to use system Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_RUNTIME="node"
        echo "✅ System Node.js detected."
    else
        echo "❌ Node.js not found on this system!"
        echo "💡 To make this truly portable, copy the 'node' binary to the 'runtime' folder."
        exit 1
    fi
fi

echo "🚀 Starting NFC Reader..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

"$NODE_RUNTIME" "$APP_BUNDLE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Reader stopped. Press any key to exit..."
read -n 1
