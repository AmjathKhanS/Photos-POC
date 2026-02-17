#!/bin/bash

# Fix Sharp Module for WSL Environment
# Run this script when you encounter sharp module errors after restarting

echo "🔧 Fixing Sharp module for WSL environment..."

# Navigate to server directory
cd "$(dirname "$0")/server" || exit 1

echo "📦 Removing sharp module..."
rm -rf node_modules/sharp

echo "🧹 Clearing npm cache..."
npm cache clean --force

echo "📥 Reinstalling sharp with correct platform binaries..."
npm install --include=optional sharp

echo "✅ Sharp module fixed!"
echo ""
echo "You can now run 'npm run dev' to start the server"
