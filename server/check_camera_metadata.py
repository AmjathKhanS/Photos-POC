#!/usr/bin/env python3
import sqlite3

DB_PATH = "D:/Photos Ai/photo-viewer/server/data/faces.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check photos with camera metadata
cursor.execute('''
    SELECT photo_filename, width, height, camera_make, camera_model,
           iso, aperture, shutter_speed, focal_length, lens_model
    FROM photo_metadata
    WHERE iso IS NOT NULL OR aperture IS NOT NULL OR shutter_speed IS NOT NULL
    LIMIT 5
''')

results = cursor.fetchall()

print(f'Photos with camera settings: {len(results) if results else 0}\n')

if results:
    for row in results:
        print(f'File: {row[0]}')
        print(f'  Dimensions: {row[1]}x{row[2]}')
        print(f'  Camera: {row[3]} {row[4]}')
        print(f'  ISO: {row[5]}')
        print(f'  Aperture: f/{row[6]:.1f}' if row[6] else '  Aperture: None')
        print(f'  Shutter: {row[7]}')
        print(f'  Focal Length: {row[8]}mm' if row[8] else '  Focal Length: None')
        print(f'  Lens: {row[9]}')
        print()

conn.close()
