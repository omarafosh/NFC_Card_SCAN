#!/bin/bash

# NFC Reader Launcher for macOS
# -----------------------------

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$DIR")"

echo "🍎 NFC Discount System - macOS Reader Launcher"
echo "=============================================="
echo "📂 Project Root: $PROJECT_ROOT"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "⬇️  Please install Node.js from https://nodejs.org/"
    read -p "Press enter to exit..."
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_ROOT"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    if [ -f ".env.example" ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
        echo "⚠️  Please edit .env file and add your Supabase credentials!"
        open .env
    else
        echo "❌ .env.example not found. Please ensure project is installed correctly."
        read -p "Press enter to exit..."
        exit 1
    fi
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the reader
echo "🚀 Starting NFC Reader (Remote Mode)..."
echo "----------------------------------------"
npm run reader

# Keep window open if it crashes
echo ""
echo "⚠️  Process exited."
read -p "Press enter to close window..."
