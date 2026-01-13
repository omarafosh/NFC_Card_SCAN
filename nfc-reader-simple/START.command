#!/bin/bash

# Simple NFC Reader Launcher for macOS
# Double-click this file to start the reader

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════╗"
echo "║   NFC Reader Setup                     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Configuration file not found!"
    echo ""
    echo "Please create a .env file with:"
    echo "  WEBSITE_URL=https://your-site.vercel.app"
    echo "  TERMINAL_ID=10"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Start the reader
echo "🚀 Starting NFC Reader..."
echo ""
npm start
