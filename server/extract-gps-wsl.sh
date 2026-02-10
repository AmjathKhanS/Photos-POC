#!/bin/bash
# Extract GPS data in WSL with Linux filesystem database

# Set up paths
LINUX_DB="$HOME/photo-viewer-db/faces.db"
WINDOWS_DB="/mnt/d/Photos Ai/photo-viewer/server/data/faces.db"
PHOTOS_DIR="/mnt/d/Photos Ai/mobile"

# Create directory if needed
mkdir -p "$HOME/photo-viewer-db"

# Copy database to Linux filesystem
echo "📋 Copying database to Linux filesystem..."
cp "$WINDOWS_DB" "$LINUX_DB"
echo "✅ Database ready"
echo ""

# Run extraction
echo "🚀 Starting GPS extraction..."
export SQLITE_DB_PATH="$LINUX_DB"
export PHOTOS_DIR="$PHOTOS_DIR"
node extract-gps-timeout.js

# Run reverse geocoding to get city/country names
echo ""
echo "🌍 Starting reverse geocoding..."
node reverse-geocode.js

# Copy database back
echo ""
echo "📋 Copying database back to Windows filesystem..."
cp "$LINUX_DB" "$WINDOWS_DB"
echo "✅ Database synced back to Windows"
echo ""
echo "🎉 Done! GPS data has been extracted, geocoded, and saved."
