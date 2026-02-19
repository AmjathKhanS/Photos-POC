#!/usr/bin/env python3
"""
Add camera EXIF metadata columns to photo_metadata table
"""

import sqlite3

DB_PATH = "D:/Photos Ai/photo-viewer/server/data/faces.db"

print(f"Adding camera metadata columns to: {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Add ISO column
try:
    cursor.execute("SELECT iso FROM photo_metadata LIMIT 1")
    print("  iso column already exists")
except sqlite3.OperationalError:
    print("  Adding iso column...")
    cursor.execute("ALTER TABLE photo_metadata ADD COLUMN iso INTEGER")

# Add aperture column (f-stop)
try:
    cursor.execute("SELECT aperture FROM photo_metadata LIMIT 1")
    print("  aperture column already exists")
except sqlite3.OperationalError:
    print("  Adding aperture column...")
    cursor.execute("ALTER TABLE photo_metadata ADD COLUMN aperture REAL")

# Add shutter_speed column
try:
    cursor.execute("SELECT shutter_speed FROM photo_metadata LIMIT 1")
    print("  shutter_speed column already exists")
except sqlite3.OperationalError:
    print("  Adding shutter_speed column...")
    cursor.execute("ALTER TABLE photo_metadata ADD COLUMN shutter_speed TEXT")

# Add focal_length column
try:
    cursor.execute("SELECT focal_length FROM photo_metadata LIMIT 1")
    print("  focal_length column already exists")
except sqlite3.OperationalError:
    print("  Adding focal_length column...")
    cursor.execute("ALTER TABLE photo_metadata ADD COLUMN focal_length REAL")

# Add lens_model column
try:
    cursor.execute("SELECT lens_model FROM photo_metadata LIMIT 1")
    print("  lens_model column already exists")
except sqlite3.OperationalError:
    print("  Adding lens_model column...")
    cursor.execute("ALTER TABLE photo_metadata ADD COLUMN lens_model TEXT")

conn.commit()
conn.close()

print("[SUCCESS] Camera metadata columns added!")
