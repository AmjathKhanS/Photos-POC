#!/bin/bash
# Start the photo viewer server in WSL with shared database access

# Set up paths
WSL_DATA_DIR="/mnt/d/Photos Ai/photo-viewer/server/data-wsl"
WINDOWS_DB="/mnt/d/Photos Ai/photo-viewer/server/data/faces.db"
WSL_DB="$WSL_DATA_DIR/faces.db"

mkdir -p "$WSL_DATA_DIR"

# Copy database to WSL-accessible location (accessible by both WSL Node.js and Windows Python)
echo "📋 Syncing database to WSL-accessible location..."
cp "$WINDOWS_DB" "$WSL_DB"
echo "✅ Database ready at: $WSL_DB"
echo ""

echo "🚀 Starting server with:"
echo "   Database: $WSL_DB"
echo "   Photos: /mnt/d/Photos Ai/mobile"
echo "   Python: /mnt/d/Photos Ai/photo-viewer/python-wrapper.sh"
echo "   Using: .env.wsl configuration"
echo ""

# Set up trap to sync database back on exit
trap 'echo ""; echo "📋 Syncing database back to Windows..."; cp "$WSL_DB" "$WINDOWS_DB"; echo "✅ Database synced"' EXIT

# Change to server directory and start with WSL env file
cd "$(dirname "$0")"
npx tsx watch --env-file=../.env.wsl src/index.ts
