#!/usr/bin/env python3
import sqlite3

DB_PATH = "D:/Photos Ai/photo-viewer/server/data/faces.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM photo_quality')
quality_count = cursor.fetchone()[0]

print(f'Photos with quality scores: {quality_count}')

if quality_count > 0:
    cursor.execute('SELECT photo_filename, quality_score, blur_score, brightness_score FROM photo_quality LIMIT 5')
    print('\nSample quality scores:')
    for row in cursor.fetchall():
        print(f'  {row[0]}: quality={row[1]:.1f}, blur={row[2]:.1f}, brightness={row[3]:.1f}')

conn.close()
