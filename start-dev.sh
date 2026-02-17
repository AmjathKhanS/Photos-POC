#!/bin/bash

# Complete Development Environment Startup Script
# This script handles common issues and starts both client and server

echo "🚀 Starting Photo Viewer Development Environment..."

# Check if sharp needs to be fixed
cd "$(dirname "$0")/server" || exit 1

if ! node -e "require('sharp')" 2>/dev/null; then
    echo "⚠️  Sharp module issue detected, fixing..."
    rm -rf node_modules/sharp
    npm cache clean --force
    npm install --include=optional sharp
    echo "✅ Sharp module fixed!"
fi

# Return to root directory
cd ..

echo "📦 Installing dependencies if needed..."
cd server && npm install && cd ..
cd client && npm install && cd ..

echo "🎬 Starting development servers..."
echo "  - Client will run on http://localhost:5173"
echo "  - Server will run on http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both client and server
npm run dev
