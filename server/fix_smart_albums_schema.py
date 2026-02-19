#!/usr/bin/env python3
"""
Fix smart_albums table schema
Adds missing columns: cluster_method and updated_at
"""

import sqlite3

DB_PATH = "D:/Photos Ai/photo-viewer/server/data/faces.db"

print(f"Fixing smart_albums schema in: {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check and add cluster_method column
try:
    cursor.execute("SELECT cluster_method FROM smart_albums LIMIT 1")
    print("  cluster_method column already exists")
except sqlite3.OperationalError:
    print("  Adding cluster_method column...")
    cursor.execute("ALTER TABLE smart_albums ADD COLUMN cluster_method TEXT DEFAULT 'visual_temporal'")

# Check and add updated_at column
try:
    cursor.execute("SELECT updated_at FROM smart_albums LIMIT 1")
    print("  updated_at column already exists")
except sqlite3.OperationalError:
    print("  Adding updated_at column...")
    cursor.execute("ALTER TABLE smart_albums ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

# Check and add added_at column to smart_album_photos
try:
    cursor.execute("SELECT added_at FROM smart_album_photos LIMIT 1")
    print("  added_at column already exists in smart_album_photos")
except sqlite3.OperationalError:
    print("  Adding added_at column to smart_album_photos...")
    cursor.execute("ALTER TABLE smart_album_photos ADD COLUMN added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

# Check and add is_cover column to smart_album_photos
try:
    cursor.execute("SELECT is_cover FROM smart_album_photos LIMIT 1")
    print("  is_cover column already exists in smart_album_photos")
except sqlite3.OperationalError:
    print("  Adding is_cover column to smart_album_photos...")
    cursor.execute("ALTER TABLE smart_album_photos ADD COLUMN is_cover INTEGER DEFAULT 0")

conn.commit()
conn.close()

print("[SUCCESS] Schema fixed successfully!")
