#!/bin/bash

# NFC Reader - macOS One-Click Setup
# This script will install dependencies and build the standalone Mac app.

echo "🚀 Starting macOS NFC Setup..."

# 1. Check for Homebrew (required for pcsc-lite on Mac)
if ! command -v brew &> /dev/null
then
    echo "🔍 Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# 2. Install PCSC Lite headers
echo "📦 Installing hardware drivers..."
brew install pcsc-lite

# 3. Install Node dependencies
echo "📥 Installing project dependencies..."
npm install

# 4. Build the standalone app
echo "🔨 Building standalone Mac app..."
npm run build:mac

echo ""
echo "✅ Done! You can now find the app 'nfc-reader-mac' in this folder."
echo "Simply run: ./nfc-reader-mac"
