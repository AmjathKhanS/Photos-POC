#!/usr/bin/env python3
import sqlite3

DB_PATH = "D:/Photos Ai/photo-viewer/server/data/faces.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check what columns exist in photo_metadata
cursor.execute('PRAGMA table_info(photo_metadata)')
columns = cursor.fetchall()

print('photo_metadata table columns:')
for col in columns:
    print(f'  {col[1]} ({col[2]})')

# Check a sample record
cursor.execute('SELECT * FROM photo_metadata LIMIT 1')
sample = cursor.fetchone()

if sample:
    print('\nSample record:')
    col_names = [desc[0] for desc in cursor.description]
    for i, col_name in enumerate(col_names):
        print(f'  {col_name}: {sample[i]}')

conn.close()
